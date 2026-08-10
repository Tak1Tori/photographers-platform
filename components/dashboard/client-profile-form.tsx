"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Save } from "lucide-react";
import { DragEvent, useEffect, useRef, useState, useTransition } from "react";
import { updateClientProfileAction } from "@/app/dashboard/client/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AccountProfile } from "@/lib/data/account";

const defaultAvatarUrl = "/images/default-avatar.png";
const avatarAccept = "image/jpeg,image/png,image/webp";

type ClientProfileFormProps = {
  account: AccountProfile;
};

export function ClientProfileForm({ account }: ClientProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateClientProfileAction(formData);

      if (!result.success) {
        setError(result.error ?? "Не удалось сохранить данные.");
        return;
      }

      router.push("/dashboard/client");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-6">
      <div className="grid gap-5 sm:grid-cols-[160px_1fr] sm:items-start">
        <div className="max-w-40">
          <AvatarUploadField
            name="avatar"
            currentUrl={account.image ?? undefined}
            previewAlt={account.name}
            maxSizeMb={25}
          />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Редактировать данные</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Эти контакты будут использоваться для бронирований и уведомлений.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        <Field label="Имя" name="name" defaultValue={account.name} autoComplete="name" />
        <Field label="Телефон" name="phone" defaultValue={account.phone ?? ""} autoComplete="tel" />
      </div>

      <div className="grid gap-3 sm:flex sm:justify-end">
        <Button asChild variant="outline" className="sm:order-first">
          <Link href="/dashboard/client">Отмена</Link>
        </Button>
        <Button disabled={isPending} className="min-h-12 sm:min-h-10">
          <Save className="size-4" aria-hidden="true" />
          {isPending ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

function AvatarUploadField({
  name,
  currentUrl,
  previewAlt,
  maxSizeMb
}: {
  name: string;
  currentUrl?: string;
  previewAlt: string;
  maxSizeMb: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl || defaultAvatarUrl);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setPreviewUrl(currentUrl || defaultAvatarUrl);
  }, [currentUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function setFile(file?: File) {
    setError("");

    if (!file) {
      setPreviewUrl(currentUrl || defaultAvatarUrl);
      return;
    }

    if (!avatarAccept.split(",").includes(file.type)) {
      setError("Поддерживаются JPEG, PNG и WebP.");
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Размер файла не должен превышать ${maxSizeMb} МБ.`);
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);

    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }

    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="grid gap-2">
      <label
        className={cn(
          "group relative block aspect-square cursor-pointer overflow-hidden rounded-lg border border-border bg-secondary outline-none transition-colors hover:border-primary/60 focus-within:border-primary/70",
          isDragging && "border-primary bg-primary/10"
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
      >
        <Image
          src={previewUrl}
          alt={previewAlt}
          fill
          sizes="160px"
          className="object-cover transition duration-200 group-hover:brightness-50 group-focus-within:brightness-50"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover:bg-black/35 group-hover:opacity-100 group-focus-within:bg-black/35 group-focus-within:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur">
            <Plus className="size-7" aria-hidden="true" />
          </span>
        </span>
        <span className="sr-only">Загрузить аватар</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={avatarAccept}
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      {error ? <p className="text-sm font-medium text-rose-300">{error}</p> : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  autoComplete
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="h-12 rounded-md border border-input bg-background px-4 text-base text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring md:h-11 md:text-sm"
      />
    </label>
  );
}
