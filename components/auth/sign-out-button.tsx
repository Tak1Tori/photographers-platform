"use client";

import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button, type ButtonProps } from "@/components/ui/button";

type SignOutButtonProps = Pick<ButtonProps, "className" | "variant" | "size"> & {
  children?: ReactNode;
  showIcon?: boolean;
};

export function SignOutButton({
  children = "Выйти",
  className,
  variant = "outline",
  size = "sm",
  showIcon = true
}: SignOutButtonProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => signOut({ callbackUrl: "/" })}
    >
      {showIcon ? <LogOut className="size-4" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}
