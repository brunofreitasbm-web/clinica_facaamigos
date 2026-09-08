import { NextResponse } from "next/server";
import { CLINICAL_DICTIONARY, searchDictionary } from "@/lib/clinical-dictionary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || searchParams.get("q") || "";
  const discipline = searchParams.get("discipline") || undefined;

  const options = searchDictionary(query, discipline);

  return NextResponse.json({
    success: true,
    total: options.length,
    options,
    all: CLINICAL_DICTIONARY,
  });
}
