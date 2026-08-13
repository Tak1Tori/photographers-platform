"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState, useTransition } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ExternalLink,
  Images,
  ListChecks,
  Link as LinkIcon,
  Plus,
  Save,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import {
  createCustomPhotographerStyleAction,
  deletePhotographerServiceAction,
  deletePortfolioItemAction,
  requestPhotographerFinalPaymentAction,
  resolvePhotographerRescheduleAction,
  savePhotographerPortfolioAction,
  savePhotographerServiceAction,
  updatePhotographerBookingStatusAction,
  updatePhotographerProfileAction
} from "@/app/dashboard/photographer/actions";
import { CalendarDashboard, type CalendarDashboardProps } from "@/components/calendar/calendar-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SuccessToast } from "@/components/shared/success-toast";
import {
  DashboardSectionTabs,
  type DashboardSectionTab
} from "@/components/dashboard/dashboard-section-tabs";
import { AlbumContentField } from "@/components/uploads/album-content-field";
import {
  clearAlbumMediaDrafts,
  cleanupUploadedAlbumMedia,
  getReadableAlbumUploadError,
  uploadAlbumMediaForSubmission
} from "@/components/uploads/album-media-upload";
import { ImageUploadField } from "@/components/uploads/image-upload-field";
import { EQUIPMENT_OPTIONS, LOCATION_TYPES, SHOOT_TYPES, getOptionLabel } from "@/lib/booking-options";
import {
  canClientBookingMoveToInProgress,
  isClientBookingBeforeStart
} from "@/lib/bookings/client-status";
import { formatPrice } from "@/lib/mock-data";
import { calculateProviderPayouts } from "@/lib/provider-payouts";
import { cn } from "@/lib/utils";
import type {
  Booking,
  PhotographerProfile,
  PhotoStyle,
  PortfolioItem,
  PhotographerService
} from "@/lib/types";

interface PhotographerDashboardManagerProps {
  profile: PhotographerProfile;
  styles: PhotoStyle[];
  portfolioItems: PortfolioItem[];
  calendar: CalendarDashboardProps;
  bookings: Booking[];
  databaseReady: boolean;
  initialSection?: PhotographerSection;
}

type ActionState = {
  area: string;
  success: boolean;
  message: string;
} | null;

const maxServerActionUploadBytes = 4 * 1024 * 1024;
type PhotographerSection = "profile" | "services" | "portfolio" | "schedule" | "bookings";

export function PhotographerDashboardManager({
  profile,
  styles,
  portfolioItems,
  calendar,
  bookings,
  databaseReady,
  initialSection = "profile"
}: PhotographerDashboardManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>(null);
  const [showCustomStyle, setShowCustomStyle] = useState(false);
  const [customStyleName, setCustomStyleName] = useState("");
  const [activeSection, setActiveSection] = useState<PhotographerSection>(initialSection);
  const [isPublicLinkCopied, setIsPublicLinkCopied] = useState(false);
  const [isCreateServiceOpen, setIsCreateServiceOpen] = useState(false);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState(false);
  const [portfolioUploadProgress, setPortfolioUploadProgress] = useState<string | null>(null);
  const isPortfolioBusy = isPending || Boolean(portfolioUploadProgress);
  const rescheduleRequestsCount = bookings.filter((booking) => booking.rescheduleRequestedAt).length;
  const sections: DashboardSectionTab<PhotographerSection>[] = [
    {
      id: "profile",
      label: "Профиль",
      description: "Данные и специализации",
      icon: UserRound
    },
    {
      id: "services",
      label: "Услуги",
      description: "Форматы, цены и длительность",
      icon: ListChecks,
      count: profile.services.length
    },
    {
      id: "portfolio",
      label: "Портфолио",
      description: "Альбомы и материалы",
      icon: Images,
      count: portfolioItems.length
    },
    {
      id: "schedule",
      label: "Расписание",
      description: "Календарь месяца",
      icon: CalendarDays,
      count: calendar.events.length
    },
    {
      id: "bookings",
      label: "Брони",
      description: rescheduleRequestsCount > 0 ? "Есть запросы на перенос" : "Заявки и оплата",
      icon: CalendarDays,
      count: bookings.length,
      attention: rescheduleRequestsCount > 0
    }
  ];

  function run(area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) {
    return (formData: FormData) => {
      setState(null);
      const uploadBytes = Array.from(formData.values()).reduce(
        (total, value) => total + (value instanceof File ? value.size : 0),
        0
      );

      if (uploadBytes > maxServerActionUploadBytes) {
        setState({
          area,
          success: false,
          message:
            "Выбрано слишком много файлов для одного сохранения. Сохраните изменения по одному альбому."
        });
        return;
      }

      startTransition(async () => {
        try {
          const result = await action(formData);
          if (!result) {
            throw new Error("Сервер не вернул ответ.");
          }
          setState({
            area,
            success: result.success,
            message: result.success
              ? "Изменения сохранены."
              : result.error ?? "Ошибка сохранения."
          });
          if (result.success) {
            if (area === "service-create") {
              setIsCreateServiceOpen(false);
            }
            if (area === "portfolio-create") {
              setIsCreatePortfolioOpen(false);
            }
            router.refresh();
          }
        } catch {
          setState({
            area,
            success: false,
            message:
              "Не удалось отправить файлы. Уменьшите количество изображений и попробуйте снова."
          });
        }
      });
    };
  }

  function runPortfolioSave(area: "portfolio-save" | "portfolio-create") {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      setState(null);
      setPortfolioUploadProgress("Подготавливаем загрузку...");

      startTransition(async () => {
        let uploadedPublicIds: string[] = [];

        try {
          const upload = await uploadAlbumMediaForSubmission(
            formData,
            area,
            (completed, total) =>
              setPortfolioUploadProgress(`Загружаем ${completed} из ${total}...`)
          );
          uploadedPublicIds = upload.uploadedPublicIds;
          setPortfolioUploadProgress("Сохраняем альбом...");

          const result = await savePhotographerPortfolioAction(formData);
          if (!result) {
            throw new Error("Сервер не вернул ответ.");
          }
          if (!result.success) {
            await cleanupUploadedAlbumMedia(uploadedPublicIds);
          }

          setState({
            area,
            success: result.success,
            message: result.success
              ? "Изменения сохранены."
              : result.error ?? "Ошибка сохранения."
          });
          if (result.success) {
            clearAlbumMediaDrafts(area);
            if (area === "portfolio-create") {
              setIsCreatePortfolioOpen(false);
            }
            router.refresh();
          }
        } catch (error) {
          await cleanupUploadedAlbumMedia(uploadedPublicIds);
          setState({
            area,
            success: false,
            message: getReadableAlbumUploadError(error)
          });
        } finally {
          setPortfolioUploadProgress(null);
        }
      });
    };
  }

  function createCustomStyle() {
    const formData = new FormData();
    formData.set("styleName", customStyleName);
    setState(null);

    startTransition(async () => {
      const result = await createCustomPhotographerStyleAction(formData);
      setState({
        area: "style-create",
        success: result.success,
        message: result.success
          ? "Стиль добавлен и выбран."
          : result.error ?? "Не удалось добавить стиль."
      });

      if (result.success) {
        setCustomStyleName("");
        setShowCustomStyle(false);
        router.refresh();
      }
    });
  }

  async function copyPublicProfileLink() {
    const publicProfileUrl = `${window.location.origin}/photographers/${profile.id}`;

    try {
      await navigator.clipboard.writeText(publicProfileUrl);
    } catch {
      const input = document.createElement("textarea");
      input.value = publicProfileUrl;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setIsPublicLinkCopied(true);
    window.setTimeout(() => setIsPublicLinkCopied(false), 2400);
  }

  return (
    <div className="grid gap-8">
      {!databaseReady ? (
        <Notice tone="error" message="DATABASE_URL не настроен. CRUD-операции требуют PostgreSQL." />
      ) : null}
      {profile.status === "Draft" ? (
        <Notice message="Профиль в draft. Заполните данные и дождитесь approval от администратора." />
      ) : null}

      <DashboardSectionTabs
        value={activeSection}
        onChange={setActiveSection}
        items={sections}
      />

      {activeSection === "profile" ? (
      <Card id="profile-editor" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle>Профиль фотографа</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={profile.status} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={profile.status !== "Published"}
                onClick={copyPublicProfileLink}
              >
                {isPublicLinkCopied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <LinkIcon className="size-4" aria-hidden="true" />
                )}
                {isPublicLinkCopied ? "Ссылка скопирована" : "Поделиться профилем"}
              </Button>
              {profile.status === "Published" ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a
                    href={`/photographers/${profile.id}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Открыть публичный профиль"
                    title="Открыть публичный профиль"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {profile.status !== "Published" ? (
            <p className="mb-5 text-sm text-muted-foreground">
              Опубликуйте профиль, чтобы клиент мог открыть ссылку без входа в аккаунт.
            </p>
          ) : null}
          <form action={run("profile", updatePhotographerProfileAction)} className="grid gap-6">
            <Message state={state} area="profile" />
            <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[220px_1fr] md:items-start">
              <div className="max-w-[220px]">
                <ImageUploadField
                  name="avatar"
                  label="Новый аватар"
                  currentUrl={profile.avatarUrl}
                  previewAlt={profile.name}
                  maxSizeMb={25}
                />
              </div>
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Имя" name="name" defaultValue={profile.name} />
                  <Field label="Город" name="city" defaultValue={profile.city} />
                </div>
                <Field label="Базовая цена за час для старых бронирований" name="hourlyRate" type="number" defaultValue={String(profile.pricePerHour)} />
                <label className="grid gap-2 text-sm font-medium">
                  Описание
                  <textarea name="bio" defaultValue={profile.bio} className={textareaClass} />
                </label>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Стили съемки</p>
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
                {styles.map((style) => (
                  <label key={style.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="styleIds"
                      value={style.id}
                      defaultChecked={profile.specializationIds.includes(style.id)}
                    />
                    {style.title}
                  </label>
                ))}
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending || !databaseReady}
                    onClick={() => setShowCustomStyle((visible) => !visible)}
                  >
                    {showCustomStyle ? (
                      <X className="size-4" aria-hidden="true" />
                    ) : (
                      <Plus className="size-4" aria-hidden="true" />
                    )}
                    {showCustomStyle ? "Отмена" : "Другие"}
                  </Button>
                </div>
              </div>
              {showCustomStyle ? (
                <div className="flex flex-col gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 sm:flex-row">
                  <input
                    type="text"
                    aria-label="Название нового стиля"
                    placeholder="Например, спортивная съемка"
                    value={customStyleName}
                    maxLength={60}
                    className={inputClass}
                    onChange={(event) => setCustomStyleName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createCustomStyle();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    disabled={isPending || customStyleName.trim().length < 2 || !databaseReady}
                    onClick={createCustomStyle}
                    className="shrink-0"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Добавить стиль
                  </Button>
                </div>
              ) : null}
              <Message state={state} area="style-create" />
            </div>
            <Button disabled={isPending || !databaseReady} className="w-full sm:w-fit sm:justify-self-end">
              <Save className="size-4" aria-hidden="true" />
              {isPending ? "Сохраняем..." : "Сохранить изменения"}
            </Button>
          </form>
        </CardContent>
      </Card>
      ) : null}

      {activeSection === "services" ? (
        <Card>
          <CardHeader className="space-y-0">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div className="grid gap-1.5">
                <CardTitle>Услуги</CardTitle>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Клиенты видят только активные услуги. Цена, длительность и состав выбранной услуги сохраняются в брони.
                </p>
              </div>
              <Button
                type="button"
                className="shrink-0"
                disabled={isPending || !databaseReady}
                onClick={() => {
                  setState(null);
                  setIsCreateServiceOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Добавить услугу
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {state?.area === "service-create" && state.success ? <SuccessToast message={state.message} /> : null}
            {profile.services.length === 0 ? <EmptyText text="Услуг пока нет. Добавьте первую, чтобы клиент мог выбрать конкретный формат съёмки." /> : (
              <div className="grid gap-6">
                {profile.services.map((service, index) => (
                  <article key={service.id} className="service-editor-card grid gap-4 rounded-lg border-2 border-border p-4 shadow-lg shadow-black/10 sm:p-5">
                    <form id={`service-${service.id}`} action={run(`service:${service.id}`, savePhotographerServiceAction)} className="grid gap-4">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm opacity-75">Услуга {index + 1}</p>
                          <h3 className="font-semibold">{service.title}</h3>
                        </div>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={service.isActive} /> Показывать клиентам</label>
                      </div>
                      <Message state={state} area={`service:${service.id}`} />
                      <ServiceFields service={service} compact appearance="service-editor" />
                    </form>
                    <div className="flex flex-wrap items-center gap-2 border-t border-current/20 pt-4">
                      <Button form={`service-${service.id}`} size="sm" className="service-save-button" disabled={isPending || !databaseReady}><Save className="size-4" aria-hidden="true" />Сохранить</Button>
                      <form action={run(`service:${service.id}`, deletePhotographerServiceAction)} className="sm:ml-auto"><input type="hidden" name="serviceId" value={service.id} /><Button size="sm" variant="outline" className="service-delete-button !border-[#2e3c28] !bg-[#2e3c28] !text-[#f6f0e6] hover:!border-[#ddd5c9] hover:!bg-[#ddd5c9] hover:!text-[#2e3c28]" disabled={isPending || !databaseReady}><Trash2 className="size-4" aria-hidden="true" />Удалить</Button></form>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>

          {isCreateServiceOpen ? (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="create-service-title">
              <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-md"
                aria-label="Закрыть форму добавления услуги"
                onClick={() => {
                  setState(null);
                  setIsCreateServiceOpen(false);
                }}
              />
              <section className="service-create-modal relative z-10 grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl shadow-black/40 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="create-service-title" className="text-xl font-semibold tracking-normal">Новая услуга</h3>
                    <p className="service-create-modal-subtitle mt-1 text-sm text-muted-foreground">Укажите итоговую стоимость услуги, а не почасовую ставку.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="service-create-modal-close size-9 shrink-0 p-0"
                    aria-label="Закрыть"
                    title="Закрыть"
                    onClick={() => {
                      setState(null);
                      setIsCreateServiceOpen(false);
                    }}
                  >
                    <X className="size-5" aria-hidden="true" />
                  </Button>
                </div>
                <form action={run("service-create", savePhotographerServiceAction)} className="mt-5 grid gap-5">
                  {state?.area === "service-create" && !state.success ? <Notice tone="error" message={state.message} /> : null}
                  <ServiceFields compact appearance="modal" />
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="isActive" defaultChecked /> Показывать клиентам</label>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="service-create-modal-cancel"
                      disabled={isPending}
                      onClick={() => {
                        setState(null);
                        setIsCreateServiceOpen(false);
                      }}
                    >
                      Отмена
                    </Button>
                    <Button disabled={isPending || !databaseReady} className="service-create-modal-submit">
                      <Plus className="size-4" aria-hidden="true" />
                      {isPending ? "Создаём..." : "Добавить услугу"}
                    </Button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </Card>
      ) : null}

      {activeSection === "portfolio" ? (
      <Card>
        <CardHeader className="space-y-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="grid gap-1.5">
              <CardTitle>Портфолио фотографа</CardTitle>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Добавляйте готовые работы и обновляйте обложки, названия и материалы каждого альбома.
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0"
              disabled={isPortfolioBusy || !databaseReady}
              onClick={() => {
                setState(null);
                setIsCreatePortfolioOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Добавить альбом
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          {state?.area === "portfolio-create" && state.success ? <SuccessToast message={state.message} /> : null}
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h4 className="text-lg font-semibold tracking-normal">Существующие альбомы</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Обновляйте обложки, названия и содержимое каждого альбома.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              {portfolioItems.length} альбомов
            </span>
          </div>
          {portfolioItems.length === 0 ? (
            <EmptyText text="Портфолио пока пустое. Добавьте первую работу через кнопку выше." />
          ) : (
            <form onSubmit={runPortfolioSave("portfolio-save")} className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-lg border border-border p-4">
                    <input type="hidden" name="portfolioItemIds" value={item.id} />
                    <Field
                      label="Название"
                      name={`portfolioTitle:${item.id}`}
                      defaultValue={item.title}
                    />
                    <AlbumContentField
                      name={`albumImages:${item.id}`}
                      uploadScope="portfolio-save"
                      disabled={isPortfolioBusy}
                      existingImages={item.albumImages}
                      initialCoverCrop={{
                        x: item.coverCropX,
                        y: item.coverCropY,
                        width: item.coverCropWidth,
                        height: item.coverCropHeight
                      }}
                    />
                    <Button
                      disabled={isPortfolioBusy || !databaseReady}
                      size="sm"
                      variant="outline"
                      type="button"
                      className="portfolio-delete-button w-fit !border-[#2e3c28] !bg-[#2e3c28] !text-[#f6f0e6] hover:!border-[#ddd5c9] hover:!bg-[#ddd5c9] hover:!text-[#2e3c28]"
                      onClick={() => {
                        if (!window.confirm("Удалить работу из портфолио?")) return;
                        const data = new FormData();
                        data.set("id", item.id);
                        run("portfolio-delete", deletePortfolioItemAction)(data);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
                <Button
                  disabled={isPortfolioBusy || !databaseReady}
                  className="w-full sm:w-fit sm:justify-self-end"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {isPending ? "Сохраняем..." : "Сохранить альбомы"}
                </Button>
                {portfolioUploadProgress ? (
                  <p className="text-sm text-muted-foreground">{portfolioUploadProgress}</p>
                ) : null}
              </form>
          )}
        </CardContent>

        {isCreatePortfolioOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="create-portfolio-title">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-md"
              aria-label="Закрыть форму добавления альбома"
              onClick={() => {
                if (isPortfolioBusy) return;
                setState(null);
                setIsCreatePortfolioOpen(false);
              }}
            />
            <section className="service-create-modal relative z-10 grid max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl shadow-black/40 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="create-portfolio-title" className="text-xl font-semibold tracking-normal">Новый альбом</h3>
                  <p className="service-create-modal-subtitle mt-1 text-sm text-muted-foreground">
                    Добавьте название и материалы новой съемки. Первую фотографию можно кадрировать прямо на обложке.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="service-create-modal-close size-9 shrink-0 p-0"
                  aria-label="Закрыть"
                  title="Закрыть"
                  onClick={() => {
                    if (isPortfolioBusy) return;
                    setState(null);
                    setIsCreatePortfolioOpen(false);
                  }}
                  disabled={isPortfolioBusy}
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              <form onSubmit={runPortfolioSave("portfolio-create")} className="mt-5 grid gap-5">
                {state?.area === "portfolio-create" && !state.success ? <Notice tone="error" message={state.message} /> : null}
                <div className="grid content-start gap-4">
                  <Field label="Название" name="newPortfolioTitle" className="service-create-input portfolio-title-input" />
                  <AlbumContentField
                    name="newAlbumImages"
                    uploadScope="portfolio-create"
                    disabled={isPortfolioBusy}
                  />
                  <p className="service-create-modal-subtitle text-sm text-muted-foreground">
                    Первая фотография станет обложкой альбома. Кадрирование доступно на самой обложке.
                  </p>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="service-create-modal-cancel"
                    disabled={isPortfolioBusy}
                    onClick={() => {
                      setState(null);
                      setIsCreatePortfolioOpen(false);
                    }}
                  >
                    Отмена
                  </Button>
                  <Button disabled={isPortfolioBusy || !databaseReady} className="service-create-modal-submit">
                    <Plus className="size-4" aria-hidden="true" />
                    {isPending ? "Создаём..." : "Добавить альбом"}
                  </Button>
                </div>
                {portfolioUploadProgress ? (
                  <p className="text-sm text-muted-foreground">{portfolioUploadProgress}</p>
                ) : null}
              </form>
            </section>
          </div>
        ) : null}
      </Card>
      ) : null}

      {activeSection === "schedule" ? (
      <CalendarDashboard
        {...calendar}
        showBackLink={false}
      />
      ) : null}

      {activeSection === "bookings" ? (
      <section>
        <h2 className="mb-4 text-2xl font-semibold tracking-normal">Бронирования фотографа</h2>
        <BookingStatusTable bookings={bookings} run={run} databaseReady={databaseReady} isPending={isPending} />
      </section>
      ) : null}
    </div>
  );
}

function BookingStatusTable({
  bookings,
  run,
  databaseReady,
  isPending
}: {
  bookings: Booking[];
  run: (area: string, action: (formData: FormData) => Promise<{ success: boolean; error?: string }>) => (formData: FormData) => void;
  databaseReady: boolean;
  isPending: boolean;
}) {
  if (bookings.length === 0) {
    return <EmptyText text="Бронирований пока нет." />;
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {bookings.map((booking) => (
          <MobileBookingCard
            key={booking.id}
            booking={booking}
            disabled={isPending || !databaseReady}
            onSubmit={run("booking", updatePhotographerBookingStatusAction)}
            onRequestFinal={run("booking", requestPhotographerFinalPaymentAction)}
            onResolveReschedule={run("booking", resolvePhotographerRescheduleAction)}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Бронь</th>
              <th className="px-4 py-3 font-medium">Клиент</th>
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Суммы</th>
              <th className="px-4 py-3 font-medium">Статус брони</th>
              <th className="px-4 py-3 font-medium">Оплата</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking, index) => (
              <Fragment key={booking.id}>
              {index > 0 ? (
                <tr aria-hidden="true">
                  <td className="h-3 bg-background p-0" colSpan={8} />
                </tr>
              ) : null}
              <tr
                className={cn(
                  "border-b border-border bg-card",
                  index % 2 === 1 && "bg-secondary/20",
                  booking.rescheduleRequestedAt && "bg-amber-400/[0.04] ring-1 ring-inset ring-amber-400/20"
                )}
              >
                <td className="px-4 py-3 font-medium">
                  <div className="grid gap-2">
                    <span>{booking.id}</span>
                    {booking.rescheduleRequestedAt ? <RescheduleBadge /> : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="grid gap-1">
                    <span>{booking.clientName}</span>
                    {canShowClientContacts(booking) ? (
                      <span className="text-xs text-muted-foreground">
                        {booking.clientPhone || "-"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Контакты после сервисного сбора</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{booking.date} · {booking.time}</td>
                <td className="px-4 py-3"><StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} /></td>
                <td className="px-4 py-3">
                  <BookingAmounts booking={booking} />
                </td>
                <td className="px-4 py-3"><StatusBadge status={booking.status} /></td>
                <td className="px-4 py-3"><StatusBadge status={booking.paymentStatus} /></td>
                <td className="px-4 py-3">
                  <StatusActions
                    booking={booking}
                    disabled={isPending || !databaseReady}
                    onSubmit={run("booking", updatePhotographerBookingStatusAction)}
                    onRequestFinal={run("booking", requestPhotographerFinalPaymentAction)}
                  />
                </td>
              </tr>
              {booking.rescheduleRequestedAt ? (
                <tr className="border-b border-border bg-amber-400/[0.03]">
                  <td className="px-4 py-3" colSpan={8}>
                    <RescheduleDecisionPanel
                      booking={booking}
                      disabled={isPending || !databaseReady}
                      onResolve={run("booking", resolvePhotographerRescheduleAction)}
                    />
                  </td>
                </tr>
              ) : null}
              {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
                <tr key={`${booking.id}-brief`} className="border-b border-border bg-secondary/35">
                  <td className="px-4 py-3" colSpan={8}>
                    <BookingBrief booking={booking} />
                  </td>
                </tr>
              ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileBookingCard({
  booking,
  disabled,
  onSubmit,
  onRequestFinal,
  onResolveReschedule
}: {
  booking: Booking;
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
  onRequestFinal: (formData: FormData) => void;
  onResolveReschedule: (formData: FormData) => void;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-[0_16px_44px_rgba(0,0,0,0.2)]",
        booking.rescheduleRequestedAt && "border-amber-400/45 bg-amber-400/[0.05]"
      )}
    >
      <div
        className={cn(
          "grid gap-0 transition",
          booking.rescheduleRequestedAt && "pointer-events-none select-none blur-[2px] opacity-45"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Запись {booking.id}
            </p>
            {booking.rescheduleRequestedAt ? (
              <div className="mt-2">
                <RescheduleBadge />
              </div>
            ) : null}
            <h3 className="mt-2 text-xl font-semibold tracking-normal">
              {booking.shootType ?? booking.styleId ?? "Фотосессия"}
            </h3>
          </div>
          <StatusBadge status={booking.bookingType ?? "FULL_SHOOT"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status={booking.status} />
          <StatusBadge status={booking.paymentStatus} />
        </div>

        <div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          <p className="text-foreground">{booking.date} · {booking.time} · {booking.durationHours} ч</p>
          <p className="mt-2">{booking.clientName}</p>
          {canShowClientContacts(booking) ? (
            <p className="mt-1 text-xs">
              {booking.clientPhone || "-"}
            </p>
          ) : (
            <p className="mt-1 text-xs">Контакты после сервисного сбора</p>
          )}
        </div>

        <div className="mt-4 rounded-md border border-border bg-background/70 p-3">
          <BookingAmounts booking={booking} />
        </div>

        <div className="mt-4">
          <StatusActions
            booking={booking}
            disabled={disabled}
            onSubmit={onSubmit}
            onRequestFinal={onRequestFinal}
          />
        </div>

        {booking.bookingType === "PHOTOGRAPHER_ONLY" ? (
          <div className="mt-4 border-t border-border pt-3">
            <BookingBrief booking={booking} />
          </div>
        ) : null}
      </div>

      {booking.rescheduleRequestedAt ? (
        <div className="absolute inset-0 z-10 flex items-center p-4">
          <RescheduleDecisionPanel
            booking={booking}
            disabled={disabled}
            onResolve={onResolveReschedule}
            compact
          />
        </div>
      ) : null}
    </article>
  );
}

function RescheduleDecisionPanel({
  booking,
  disabled,
  onResolve,
  compact = false
}: {
  booking: Booking;
  disabled: boolean;
  onResolve: (formData: FormData) => void;
  compact?: boolean;
}) {
  const comment = getRescheduleComment(booking.rescheduleComment);

  function resolve(decision: "accept" | "decline") {
    const data = new FormData();
    data.set("bookingId", booking.dbId ?? booking.id);
    data.set("decision", decision);
    onResolve(data);
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-amber-300/40 bg-background/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-md",
        compact ? "grid gap-3" : "flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <RescheduleBadge />
          <span className="text-sm font-semibold text-foreground">
            {booking.date} · {booking.time} · {booking.durationHours} ч
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {comment || "Клиент запросил перенос без комментария."}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={disabled} onClick={() => resolve("accept")}>
          Перенести
        </Button>
        <Button
          disabled={disabled}
          variant="outline"
          onClick={() => resolve("decline")}
        >
          Отказаться
        </Button>
      </div>
    </div>
  );
}

function RescheduleBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-200">
      <AlertTriangle className="size-3" aria-hidden="true" />
      Запрошен перенос
    </span>
  );
}

function getRescheduleComment(value?: string) {
  if (!value) return "";
  return value.replace(/^Запрошен перенос на .+?(?:\. Комментарий:\s*)?/i, "").trim();
}

function BookingAmounts({ booking }: { booking: Booking }) {
  const hasStudioPart = booking.studioTotal > 0;
  const payouts = calculateProviderPayouts(booking);
  const hasSeveralProviders = payouts.photographerGross > 0 && payouts.studioGross > 0;

  return (
    <div className="grid gap-1 text-sm">
      {hasStudioPart ? (
        <span>Общая услуга: {formatPrice(booking.totalServicePrice ?? booking.totalAmount)}</span>
      ) : null}
      <span>Фотографу: {formatPrice(payouts.photographerGross)}</span>
      <span className="text-muted-foreground">
        {hasSeveralProviders ? "Сбор платформы всего" : "Сбор платформы"}:{" "}
        {formatPrice(payouts.platformFee)}
      </span>
      {hasSeveralProviders ? (
        <span className="text-muted-foreground">
          Доля сбора фотографа: {formatPrice(payouts.photographerFeeShare)}
        </span>
      ) : null}
      <span className="text-muted-foreground">Оплачено платформе: {formatPrice(booking.paidAmount)}</span>
      <span className="font-medium text-emerald-200">
        К выплате фотографу: {formatPrice(payouts.photographerPayout)}
      </span>
    </div>
  );
}

function BookingBrief({ booking }: { booking: Booking }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium">Бриф съемки</summary>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
        <BriefItem label="Тип" value={getOptionLabel(SHOOT_TYPES, booking.shootType)} />
        <BriefItem label="Локация" value={getOptionLabel(LOCATION_TYPES, booking.locationType)} />
        <BriefItem label="Город/район" value={[booking.city, booking.district].filter(Boolean).join(", ") || "-"} />
        <BriefItem label="Людей" value={booking.peopleCount ? String(booking.peopleCount) : "-"} />
        <BriefItem
          label="Оборудование"
          value={booking.equipmentNeeded?.map((item) => getOptionLabel(EQUIPMENT_OPTIONS, item)).join(", ") ?? "-"}
        />
        <BriefItem label="Описание" value={booking.shootDescription ?? "-"} />
        <BriefItem label="Адрес" value={booking.addressDetails ?? "-"} />
        <BriefItem label="Особые требования" value={booking.specialRequirements ?? "-"} />
      </div>
    </details>
  );
}

function canShowClientContacts(booking: Booking) {
  return (
    (booking.platformFeeStatus === "PAID" ||
      ["DEPOSIT_PAID", "FINAL_PAYMENT_PENDING", "FULLY_PAID"].includes(booking.paymentStatus)) &&
    ["Confirmed", "In progress", "Completed"].includes(booking.status)
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function StatusActions({
  booking,
  disabled,
  onSubmit,
  onRequestFinal
}: {
  booking: Booking;
  disabled: boolean;
  onSubmit: (formData: FormData) => void;
  onRequestFinal: (formData: FormData) => void;
}) {
  const statuses =
    booking.status === "Pending"
      ? ["CONFIRMED", "DECLINED"]
      : booking.status === "Confirmed"
        ? ["IN_PROGRESS", "CANCELLED"]
        : [];
  const canRequestFinal =
    booking.status === "In progress" &&
    (booking.platformFeeStatus === "PAID" || booking.paymentStatus === "DEPOSIT_PAID");
  const isBeforeStart = isClientBookingBeforeStart(booking);
  const canMoveToInProgress = canClientBookingMoveToInProgress(booking);

  return (
    <div className="grid gap-2">
      {booking.status === "Pending" &&
      booking.platformFeeStatus !== "PAID" &&
      booking.paymentStatus !== "DEPOSIT_PAID" ? (
        <p className="text-xs text-muted-foreground">Нельзя подтвердить бронь до оплаты сервисного сбора.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={status === "CONFIRMED" || status === "IN_PROGRESS" ? "default" : "outline"}
          disabled={
            disabled ||
            (status === "IN_PROGRESS" && !canMoveToInProgress) ||
            (status === "CONFIRMED" &&
              booking.platformFeeStatus !== "PAID" &&
              booking.paymentStatus !== "DEPOSIT_PAID")
          }
          onClick={() => {
            const data = new FormData();
            data.set("bookingId", booking.dbId ?? booking.id);
            data.set("status", status);
            onSubmit(data);
          }}
        >
          {bookingActionLabels[status] ?? status}
        </Button>
      ))}
      {canRequestFinal ? (
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => {
            const data = new FormData();
            data.set("bookingId", booking.dbId ?? booking.id);
            onRequestFinal(data);
          }}
        >
          Работа завершена
        </Button>
      ) : null}
      </div>
      {booking.status === "Confirmed" && isBeforeStart ? (
        <span className="text-xs text-muted-foreground">
          Статус «В работе» станет доступен в дату и время начала брони.
        </span>
      ) : null}
      {booking.paymentStatus === "FINAL_PAYMENT_PENDING" ? (
        <span className="text-xs text-amber-300">Остаток оплачивается напрямую исполнителю.</span>
      ) : null}
      {booking.paymentStatus === "FULLY_PAID" ? (
        <span className="text-xs text-emerald-300">Сервисный сбор оплачен.</span>
      ) : null}
    </div>
  );
}

const bookingActionLabels: Record<string, string> = {
  CONFIRMED: "Подтвердить",
  DECLINED: "Отклонить",
  IN_PROGRESS: "В работе",
  CANCELLED: "Отменить"
};

function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
  className = inputClass
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input name={name} type={type} defaultValue={defaultValue} className={className} />
    </label>
  );
}

function ServiceFields({
  service,
  compact = false,
  appearance = "default"
}: {
  service?: PhotographerService;
  compact?: boolean;
  appearance?: "default" | "service-editor" | "modal";
}) {
  const controlClass = cn(
    inputClass,
    appearance === "service-editor" && "service-editor-input",
    appearance === "modal" && "service-create-input"
  );
  const notesClass = cn(
    textareaClass,
    appearance === "service-editor" && "service-editor-input",
    appearance === "modal" && "service-create-input"
  );

  return (
    <div className={cn("grid gap-4", compact && "gap-3")}>
      <div className={cn("grid gap-4 sm:grid-cols-2", compact && "lg:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)] lg:gap-3")}>
        <Field label="Название" name="title" defaultValue={service?.title ?? ""} className={controlClass} />
        <Field label="Стоимость, ₸" name="price" type="number" defaultValue={service ? String(service.price) : ""} className={controlClass} />
        <label className={cn("grid gap-2 text-sm font-medium sm:col-span-2", compact && "lg:col-span-1")}>Длительность<input name="durationMinutes" type="number" min={30} max={720} step={30} defaultValue={service ? String(service.durationMinutes) : "60"} className={controlClass} /></label>
      </div>
      <div className={cn("grid gap-4", compact && "lg:grid-cols-2 lg:gap-3")}>
        <label className="grid gap-2 text-sm font-medium">Описание<textarea name="description" defaultValue={service?.description ?? ""} className={notesClass} /></label>
        <label className="grid gap-2 text-sm font-medium">Что входит<textarea name="included" defaultValue={service?.included.join("\n") ?? ""} placeholder="По одному пункту на строку" className={notesClass} /></label>
      </div>
    </div>
  );
}

function Message({ state, area }: { state: ActionState; area: string }) {
  if (!state || state.area !== area) return null;
  return state.success ? <SuccessToast message={state.message} /> : <Notice tone="error" message={state.message} />;
}

function Notice({ message, tone = "info" }: { message: string; tone?: "info" | "success" | "error" }) {
  const className =
    tone === "success"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "error"
        ? "bg-rose-100 text-rose-800"
        : "bg-secondary text-secondary-foreground";

  return <p className={`rounded-md px-4 py-3 text-sm font-medium ${className}`}>{message}</p>;
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring";
