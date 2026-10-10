import { Platform } from "react-native";

/**
 * Saves/shares a Blob (e.g. a fetched report in JSON/CSV/PDF format) in a
 * way that works on both Web and Android, since the two platforms have no
 * common "download a file" API.
 *
 * - Web: creates an object URL and triggers a normal browser download.
 * - Android (and iOS): writes the blob to the app's cache directory via
 *   expo-file-system, then opens the native share sheet via expo-sharing
 *   so the user can save it, send it, or open it in another app.
 */
export async function saveOrShareBlob(blob: Blob, filename: string, mimeType: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  // Native: Blob -> base64 (via FileReader, available in the RN runtime)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const FileSystem = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType });
  }
}
