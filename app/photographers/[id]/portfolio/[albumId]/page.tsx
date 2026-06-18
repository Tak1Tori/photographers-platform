import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Images } from "lucide-react";
import { notFound } from "next/navigation";
import { AlbumPhotoGrid } from "@/components/portfolio/album-photo-grid";
import { Button } from "@/components/ui/button";
import {
  getPhotographerById,
  getPublicPortfolioItem
} from "@/lib/data/photographers";

interface AlbumPageProps {
  params: {
    id: string;
    albumId: string;
  };
}

export default async function PhotographerAlbumPage({ params }: AlbumPageProps) {
  const [photographer, album] = await Promise.all([
    getPhotographerById(params.id),
    getPublicPortfolioItem(params.id, params.albumId)
  ]);

  if (!photographer || !album) {
    notFound();
  }

  return (
    <>
      <section className="relative min-h-[68vh] overflow-hidden border-b border-border">
        <Image
          src={album.imageUrl}
          alt={album.title || "Обложка альбома"}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="container relative flex min-h-[68vh] flex-col justify-between py-6 md:py-10">
          <Button asChild variant="secondary" size="sm" className="w-fit">
            <Link href={`/photographers/${photographer.id}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Назад к фотографу
            </Link>
          </Button>
          <div className="max-w-3xl pb-4 text-white md:pb-8">
            <p className="mb-3 text-sm font-medium">
              {photographer.name} · портфолио
            </p>
            <h1 className="text-4xl font-semibold tracking-normal md:text-6xl">
              {album.title || "Без названия"}
            </h1>
            {album.description ? (
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 md:text-lg">
                {album.description}
              </p>
            ) : null}
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
              <Images className="size-4" aria-hidden="true" />
              {album.albumImages.length} фотографий
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="mb-7">
            <p className="text-sm font-medium text-primary">Содержимое альбома</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal md:text-3xl">
              Фотографии съемки
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Нажмите на фотографию, чтобы открыть её на весь экран.
            </p>
          </div>
          <AlbumPhotoGrid
            albumTitle={album.title || "Альбом"}
            images={album.albumImages}
          />
        </div>
      </section>
    </>
  );
}
