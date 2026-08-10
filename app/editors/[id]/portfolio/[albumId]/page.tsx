import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Images } from "lucide-react";
import { AlbumPhotoGrid } from "@/components/portfolio/album-photo-grid";
import { Button } from "@/components/ui/button";
import { getCoverCropPresentation } from "@/lib/cover-crop";
import { getPublicEditorAlbumPageData } from "@/lib/data/editors";

export const dynamic = "force-dynamic";

export default async function EditorAlbumPage({ params }: { params: { id: string; albumId: string } }) {
  const pageData = await getPublicEditorAlbumPageData(params.id, params.albumId);
  if (!pageData) notFound();

  const { editor, album } = pageData;
  const coverPresentation = getCoverCropPresentation({ x: album.coverCropX, y: album.coverCropY, width: album.coverCropWidth, height: album.coverCropHeight });

  return (
    <>
      <section className="relative h-[58vh] min-h-[420px] max-h-[760px] overflow-hidden border-b border-border md:h-[68vh] md:min-h-[560px]">
        <Image src={album.imageUrl} alt={album.title || "Обложка альбома"} fill priority sizes="100vw" className="object-cover" style={coverPresentation} />
        <div className="pointer-events-none absolute inset-0 bg-black/10 backdrop-blur-[6px]" />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container relative flex h-full flex-col justify-between py-5 md:py-10">
          <Button asChild variant="secondary" size="sm" className="w-fit"><Link href={`/editors/${editor.id}`}><ArrowLeft className="size-4" aria-hidden="true" />Назад к монтажеру</Link></Button>
          <div className="max-w-3xl pb-4 text-white md:pb-8"><p className="mb-3 text-sm font-medium">{editor.name} · портфолио</p><h1 className="text-4xl font-semibold tracking-normal sm:text-5xl md:text-6xl">{album.title || "Без названия"}</h1><p className="mt-5 inline-flex items-center gap-2 text-sm font-medium"><Images className="size-4" aria-hidden="true" />{album.albumImages.length} файлов</p></div>
        </div>
      </section>
      <section className="section"><div className="container"><div className="mb-7"><p className="text-sm font-medium text-primary">Содержимое альбома</p><h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">Работы монтажера</h2></div><AlbumPhotoGrid albumTitle={album.title || "Альбом"} images={album.albumImages} /></div></section>
    </>
  );
}
