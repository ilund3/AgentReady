import { FolderIcon } from "lucide-react";
import React, { type ChangeEvent, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DropzoneProps
	extends Omit<
		React.InputHTMLAttributes<HTMLInputElement>,
		"value" | "onChange"
	> {
	classNameWrapper?: string;
	className?: string;
	dropMessage: string;
	onChange: (acceptedFiles: FileList | null) => void;
}

export const Dropzone = React.forwardRef<HTMLDivElement, DropzoneProps>(
	({ className, classNameWrapper, dropMessage, onChange, ...props }, ref) => {
		const inputRef = useRef<HTMLInputElement | null>(null);
		// Function to handle drag over event
		const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			onChange(null);
		};

		// Function to handle drop event
		const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			const { files } = e.dataTransfer;
			if (inputRef.current) {
				inputRef.current.files = files;
				onChange(files);
			}
		};

		const handleClick = () => {
			inputRef.current?.click();
		};
		return (
			<Card
				ref={ref}
				className={cn(
					"border-2 border-dashed bg-muted/20 hover:cursor-pointer hover:border-muted-foreground/50 ",
					classNameWrapper,
				)}
			>
				<CardContent
					className="relative flex flex-col items-center justify-center space-y-2 px-2 py-4 text-xs h-96"
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={handleClick}
				>
					{/* 1px input so programmatic click() works; positioned in corner so Finder uses tiny rect and doesn't open huge */}
					<Input
						{...props}
						value={undefined}
						ref={inputRef}
						type="file"
						className={cn(
							"absolute left-0 top-0 w-px h-px opacity-0 overflow-hidden border-0 p-0 m-0",
							className,
						)}
						onChange={(e: ChangeEvent<HTMLInputElement>) => {
							onChange(e.target.files);
							e.target.value = "";
						}}
					/>
					<div className="flex items-center justify-center text-muted-foreground pointer-events-none">
						<span className="font-medium text-xl flex items-center gap-2">
							<FolderIcon className="size-6 text-muted-foreground" />
							{dropMessage}
						</span>
					</div>
				</CardContent>
			</Card>
		);
	},
);
