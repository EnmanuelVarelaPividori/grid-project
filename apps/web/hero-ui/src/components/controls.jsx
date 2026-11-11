import {cloneElement, useId} from "react";
import {Checkbox} from "./ui/checkbox";
import {Input as UIInput} from "./ui/input";
import {Label} from "./ui/label";
import {Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue} from "./ui/select";
import {Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle} from "./ui/sheet";
export function Field({label, children, help}) {
	const id = useId();
	return (
		<div className="field">
			<Label htmlFor={id} id={`${id}-label`}>
				{label}
			</Label>
			{cloneElement(children, {
				id,
				"aria-labelledby": `${id}-label`,
				...(help ? {"aria-describedby": `${id}-help`} : {}),
			})}
			{help && <small id={`${id}-help`}>{help}</small>}
		</div>
	);
}
export function Input({value, onChange, ...props}) {
	return <UIInput {...props} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />;
}
export function Select({value, onChange, options, id, className, ...props}) {
	return (
		<UISelect value={value || undefined} onValueChange={onChange}>
			<SelectTrigger {...props} className={className} id={id}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => {
					const [key, label] = Array.isArray(option) ? option : [option, option];
					return (
						<SelectItem key={key} value={key}>
							{label}
						</SelectItem>
					);
				})}
			</SelectContent>
		</UISelect>
	);
}
export function Check({checked, onChange, children}) {
	const id = useId();
	return (
		<div className="check">
			<Checkbox checked={!!checked} id={id} onCheckedChange={(value) => onChange(value === true)} />
			<Label htmlFor={id}>{children}</Label>
		</div>
	);
}
export function Drawer({title, eyebrow, onClose, children}) {
	return (
		<Sheet
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}>
			<SheetContent className="workspace-sheet" side="right">
				<SheetHeader>
					<SheetDescription>{eyebrow}</SheetDescription>
					<SheetTitle>{title}</SheetTitle>
				</SheetHeader>
				<div className="workspace-sheet-body">{children}</div>
			</SheetContent>
		</Sheet>
	);
}
