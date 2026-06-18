"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { getStyleTitles } from "@/lib/mock-data";
import type { PhotographerProfile, StudioProfile } from "@/lib/types";

type ProfileFormProps =
  | {
      type: "photographer";
      profile: PhotographerProfile;
    }
  | {
      type: "studio";
      profile: StudioProfile;
    };

export function ProfileForm(props: ProfileFormProps) {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(props.profile.status);
  const [name, setName] = useState(props.profile.name);
  const [city, setCity] = useState(props.profile.city);
  const [description, setDescription] = useState(
    props.type === "photographer" ? props.profile.bio : props.profile.description
  );
  const [price, setPrice] = useState(
    props.type === "photographer" ? String(props.profile.pricePerHour) : ""
  );
  const [address, setAddress] = useState(props.type === "studio" ? props.profile.address : "");
  const [rules, setRules] = useState(
    props.type === "studio" ? props.profile.rules.join("\n") : ""
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <CardTitle>
            {props.type === "photographer" ? "Профиль фотографа" : "Профиль студии"}
          </CardTitle>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {saved ? (
          <div className="rounded-md bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-800">
            Changes saved locally
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={props.type === "photographer" ? "Имя" : "Название"}>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </Field>
          <Field label="Город">
            <input value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} />
          </Field>
        </div>
        {props.type === "photographer" ? (
          <>
            <Field label="Специализации">
              <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2">
                {getStyleTitles(props.profile.specializationIds).map((style) => (
                  <span key={style} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {style}
                  </span>
                ))}
              </div>
            </Field>
            <Field label="Цена за час">
              <input value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Адрес">
              <input value={address} onChange={(event) => setAddress(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Правила аренды">
              <textarea value={rules} onChange={(event) => setRules(event.target.value)} className={textareaClass} />
            </Field>
          </>
        )}
        <Field label="Описание">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={textareaClass}
          />
        </Field>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2200);
            }}
          >
            <Save className="size-4" aria-hidden="true" />
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={() => setStatus(status === "Published" ? "Draft" : "Published")}
          >
            Toggle status
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
