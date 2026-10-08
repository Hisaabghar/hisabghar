import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './firebase'

export async function uploadVoiceNote(userId: string, blob: Blob): Promise<string> {
  const path = `voice-notes/${userId}/${crypto.randomUUID()}.webm`
  await uploadBytes(ref(storage, path), blob, { contentType: 'audio/webm' })
  return path
}

export async function getVoiceNoteUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
