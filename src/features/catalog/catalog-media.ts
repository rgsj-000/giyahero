import type { SupabaseClient } from "@supabase/supabase-js";
export async function validatePackageImage(
  file: File,
): Promise<"jpg" | "png" | "webp"> {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Choose an image up to 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng = [137, 80, 78, 71, 13, 10, 26, 10].every(
    (b, i) => bytes[i] === b,
  );
  const isJpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const isWebp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  if (file.type === "image/png" && isPng && ext === "png") return "png";
  if (file.type === "image/jpeg" && isJpg && (ext === "jpg" || ext === "jpeg"))
    return "jpg";
  if (file.type === "image/webp" && isWebp && ext === "webp") return "webp";
  throw new Error("Choose a valid JPEG, PNG, or WebP image.");
}
export async function uploadPackageImage(
  client: SupabaseClient,
  packageId: string,
  file: File,
  altText: string,
): Promise<string> {
  const ext = await validatePackageImage(file);
  if (altText.trim().length < 2 || altText.trim().length > 200)
    throw new Error("Describe the image in 2–200 characters.");
  const { data: packageRow, error: packageError } = await client
    .from("packages")
    .select("agency_id")
    .eq("id", packageId)
    .single();
  if (packageError) throw new Error(packageError.message);
  const id = crypto.randomUUID();
  const path =
    "agency/" +
    packageRow.agency_id +
    "/package/" +
    packageId +
    "/" +
    id +
    "." +
    ext;
  const { error: uploadError } = await client.storage
    .from("package-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await client.rpc("register_package_media", {
    target_package_id: packageId,
    target_media_id: id,
    target_storage_path: path,
    target_alt_text: altText,
  });
  if (error) {
    await client.storage.from("package-media").remove([path]);
    throw new Error(error.message);
  }
  return id;
}
export async function removePackageImage(
  client: SupabaseClient,
  mediaId: string,
): Promise<void> {
  const { data: path, error } = await client.rpc("remove_package_media", {
    target_media_id: mediaId,
  });
  if (error) throw new Error(error.message);
  const { error: removeError } = await client.storage
    .from("package-media")
    .remove([path]);
  if (removeError)
    throw new Error(
      "Image was removed from the listing. File cleanup failed; please contact support.",
    );
}
