import { supabase, VOICE_NOTES_BUCKET } from './supabase'

export async function uploadVoiceNote(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.webm`
  const { error } = await supabase.storage.from(VOICE_NOTES_BUCKET).upload(path, blob, {
    contentType: 'audio/webm',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function getVoiceNoteUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(VOICE_NOTES_BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}
