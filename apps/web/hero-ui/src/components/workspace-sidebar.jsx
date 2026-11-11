import {CircleHelp, CircleUserRound, History, LayoutDashboard, Map} from "lucide-react";
import {Brand} from "./brand.jsx";
import {Badge} from "./ui/badge";
import {
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarRail,
	useSidebar,
} from "./ui/sidebar";
const navigationIcons = {dashboard: LayoutDashboard, activity: History, explore: Map, myspace: CircleUserRound};

export function WorkspaceSidebar({page, pages, onNavigate, onSources}) {
	const {setOpenMobile} = useSidebar();
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="sidebar-brand">
					<Brand />
					<Badge variant="secondary">Demo</Badge>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Your energy</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{Object.entries(pages).map(([key, label]) => {
								const NavigationIcon = navigationIcons[key] ?? LayoutDashboard;
								return (
									<SidebarMenuItem key={key}>
										<SidebarMenuButton
											aria-current={page === key ? "page" : undefined}
											aria-label={label}
											className="group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5!"
											isActive={page === key}
											tooltip={label}
											onClick={() => {
												onNavigate(key);
												setOpenMobile(false);
											}}>
											<NavigationIcon aria-hidden="true" size={18} strokeWidth={1.75} />
											<span>{label}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							aria-label="About this data"
							className="group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5!"
							tooltip="About this data"
							onClick={() => {
								setOpenMobile(false);
								onSources();
							}}>
							<CircleHelp aria-hidden="true" size={18} strokeWidth={1.75} />
							<span>About this data</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<p className="sidebar-note">Less to manage. More to gain.</p>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
