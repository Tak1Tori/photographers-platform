"use client";

import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadButton({
  children = "Upload",
  pending = false,
  disabled = false
}: {
  children?: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button disabled={disabled || pending} className="w-fit">
      <Upload className="size-4" aria-hidden="true" />
      {pending ? "Uploading..." : children}
    </Button>
  );
}
