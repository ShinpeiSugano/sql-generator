import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"; // PrismaはEdge不可なので必須

type UploadPayload = {
  dbType: "mysql" | "bigquery" | "postgres";
  version: string;
  content: string; // DDL + Markdown をまとめたもの
  isActive?: boolean;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // roleチェック（NextAuthのsession.user.roleが入ってる前提）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session.user as any)?.role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as UploadPayload;

  if (!body.version?.trim()) {
    return NextResponse.json({ error: "version is required" }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const created = await prisma.schemaDocument.create({
    data: {
      dbType: body.dbType,
      version: body.version,
      content: body.content,
      isActive: Boolean(body.isActive),
    },
  });

  // isActiveをONにしたら同DB種別の他をOFFにする（仕様に合わせる）
  if (body.isActive) {
    await prisma.schemaDocument.updateMany({
      where: {
        dbType: body.dbType,
        id: { not: created.id },
      },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ ok: true, id: created.id });
}
