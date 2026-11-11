# Deployment naar hiqual

Publieke URL: **https://aigrunn.evarela.dev**.

De app draait als een niet-root Docker-container op `hiqual`. Nginx biedt een vaste origin aan op **http://192.168.178.39:3002** (en localhost:3002). De bestaande Cloudflare Tunnel kan daar rechtstreeks naartoe. De bestaande hiqual-applicaties blijven op hun eigen poorten draaien.

## Wat je nog instelt

### 1. Cloudflare: publieke hostname

Voeg bij de bestaande Tunnel een **Published application route** toe:

| Instelling   | Waarde                |
| ------------ | --------------------- |
| Hostname     | `aigrunn.evarela.dev` |
| Service type | HTTP                  |
| Service URL  | `192.168.178.39:3002` |

Gebruik het LAN-adres als de Tunnel-connector op een andere machine in hetzelfde netwerk draait. Alleen als de connector op hiqual zelf draait, kan `localhost:3002` worden gebruikt. Er zijn geen nieuwe internetpoorten of DNS A-records naar een publiek IP nodig.

### 2. Cloudflare: CI-toegang tot de bestaande SSH-route

Maak in Cloudflare Zero Trust een **Service Token** voor GitHub Actions. Voeg bij de bestaande Access-applicatie voor `ssh-hiqual.giisoftware.com` een extra policy met actie **Service Auth** toe, met uitsluitend deze token als Include-regel. Laat bestaande toegangsregels staan.

De workflow gebruikt een geverifieerde, gepinde `cloudflared`-client. Hij geeft de token via omgevingsvariabelen door, niet via command-lineargumenten.

### 3. GitHub: repository secrets en variable

In Settings → Secrets and variables → Actions:

| Type     | Naam                      | Inhoud                                                                                                                                                                       |
| -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret   | `DEPLOY_SSH_PRIVATE_KEY`  | De volledige speciaal hiervoor aangemaakte private SSH-key, inclusief BEGIN/END-regels. Het lokale pad wordt in de oplevering genoemd. Gebruik niet je persoonlijke SSH-key. |
| Secret   | `CF_ACCESS_CLIENT_ID`     | Client ID van de nieuwe Cloudflare Service Token                                                                                                                             |
| Secret   | `CF_ACCESS_CLIENT_SECRET` | Client Secret van diezelfde token                                                                                                                                            |
| Variable | `DEPLOY_ENABLED`          | `true`, nadat de bovenstaande gegevens zijn toegevoegd                                                                                                                       |

Optioneel: `DEPLOY_SSH_HOST` en `DEPLOY_SSH_USER`. De defaults zijn respectievelijk `ssh-hiqual.giisoftware.com` en `manu`. Er is geen registry-token, Cloudflare DNS API-token of self-hosted GitHub-runner nodig.

De server accepteert de speciale deployment-key alleen voor `deploy <commit-sha>` en `status`. Een interactieve shell en forwarding zijn uitgeschakeld voor deze key. De openbare SSH-hostkey is gecontroleerd via de bestaande geauthenticeerde verbinding en staat gepind in `deploy/ssh_known_hosts`.

## Wanneer wordt er gedeployed?

- Pushes naar `main` en `codex/**`, en pull requests naar `main`: checks, tests, Docker-build en een smoke-test van de echte production-container.
- Alleen geslaagde pushes naar **main**, of een handmatige **Run workflow**, kunnen deployen, en alleen met `DEPLOY_ENABLED=true`.
- Om de nieuwe branch vóór de merge te testen: open de Actions-workflow op die branch en gebruik Run workflow. Workflow dispatch is pas zichtbaar in de standaard GitHub Actions-UI als de workflow ook op de default branch bekend is; na de merge is dit direct beschikbaar.
- Fork pull requests hebben geen deployment-toegang.
- De eenmalige eerste serverdeployment kan via de bestaande `ssh hiqual`-verbinding worden uitgevoerd, voordat de CI-secrets zijn ingesteld.

## Wat de pipeline doet

1. Installeert de vastgelegde dependencies met Vite+ en de pnpm-lockfile.
2. Draait `vp check`, `vp test` en shellvalidatie.
3. Bouwt beide workspace-apps én de productie-runtime voor de landing als Docker-image met de volledige commit-SHA.
4. Start de image zonder rootrechten en controleert `/healthz` en de server-rendered homepage.
5. Bewaart de image kort als Actions-artifact. Alleen dat gebouwde artifact gaat door naar deployment.
6. Stuurt de gecomprimeerde image via Cloudflare Access + SSH naar hiqual.
7. Start de inactieve blue/green-container en controleert HTTP en de verwachte commit-SHA.
8. Schakelt nginx om, controleert opnieuw en stopt daarna de oude container. Een mislukte controle herstelt de vorige upstream.

Build- en runtime-images zijn vastgelegd met een digest. GitHub Actions zijn gepind op volledige commit-SHA's. Deployments worden zowel in Actions als op de server geserialiseerd.

## Serverbeheer

Bestanden staan in `/opt/grid-project`. Scripts in `bin/` zijn root-owned. Configuratie en status zijn gescheiden van de application-image. Runtime-containers gebruiken maximaal 384 MiB geheugen en 1 CPU, een read-only filesystem, beperkte processen en logrotatie.

```sh
ssh hiqual
cat /opt/grid-project/state/current.json
docker ps --filter name=grid-project
curl --fail http://127.0.0.1:3002/healthz
docker logs --tail 100 grid-project-blue   # of green; zie current.json
```

Een eerdere lokale image kan opnieuw worden gedeployed (neem een echte SHA uit `docker image ls grid-project`):

```sh
revision=VOLLEDIGE_COMMIT_SHA
docker image save "grid-project:$revision" | gzip -1 | /opt/grid-project/bin/deploy.sh "$revision"
```

De server bewaart application-images zodat rollback mogelijk blijft. Verwijder oude `grid-project`-images na verloop van tijd gericht; draai geen globale Docker-prune op deze gedeelde server.

Wijzigingen in `deploy/*.sh` of nginx-config worden bewust niet op afstand uitgevoerd door de beperkte CI-key. Een beheerder werkt die expliciet bij via de normale SSH-toegang:

```sh
sudo bash deploy/bootstrap.sh
```

## Lokaal controleren

```sh
pnpm check
pnpm test
pnpm build
PORT=8080 pnpm start
curl --fail http://127.0.0.1:8080/healthz
```

De productieadapter serveert `apps/landing/dist/client` en stuurt dynamische requests naar de fetch-handler in `apps/landing/dist/server/server.js`. Met `APP_NAME=web` kiest de adapter de overeenkomstige bestanden onder `apps/web`; de standaard hiqual-pipeline blijft alleen de landing deployen. Een gewone nginx static-files-container is daarom niet voldoende voor deze TanStack Start-app.

De monorepo bevat `apps/landing` en `apps/web` met één workspace-lockfile. CI controleert en test beide apps plus de gedeelde HTTP-adapter. De Docker-build bouwt beide apps; het standaard runtime-image en de hiqual-deployment selecteren de landing. Een dashboard-image kan apart gebouwd worden met `--build-arg APP_NAME=web`; een tweede publiek domein/deployment is nog niet ingericht.
