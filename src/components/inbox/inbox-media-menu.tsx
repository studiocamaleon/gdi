"use client";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLegacyDesignScope } from "@/components/design-system/appearance";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import s from "./inbox-adjunto.module.css";

export function InboxMediaMenu({
  url,
  nombre,
  video = false,
}: {
  url: string;
  nombre: string;
  video?: boolean;
}) {
  const tema = useLegacyDesignScope();
  return (
    <div className={s.mediaMenu} data-video={video}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" />}
          aria-label={video ? "Opciones del video" : "Opciones del audio"}
          title={video ? "Opciones del video" : "Opciones del audio"}
        >
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent {...tema} align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem render={<a href={url} download={nombre} />}>
              <Download /> Descargar
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
