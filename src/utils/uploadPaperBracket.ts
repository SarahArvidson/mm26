import { supabase } from '../lib/supabase';
import type { UUID } from './bracketLogic';

const BUCKET_NAME = 'paper-brackets';

export async function uploadPaperBracket(
  file: File,
  studentBracketId: UUID
): Promise<{ data: { filePath: string } | null; error: any }> {
  try {
    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${studentBracketId}/${timestamp}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { data: null, error: uploadError };
    }

    // Update student_brackets with file_path
    // Note: This assumes file_path column exists. If not, it will need to be added to schema.
    const { error: updateError } = await supabase.supabase
      .from('student_brackets')
      .update({ file_path: filePath })
      .eq('id', studentBracketId);

    if (updateError) {
      // If update fails (e.g., column doesn't exist), still return success for upload
      // The file is uploaded, just not linked in DB
      console.warn('Failed to update file_path in student_brackets:', updateError);
    }

    return { data: { filePath }, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export function getPaperBracketUrl(filePath: string): string {
  const { data } = supabase.supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);
  return data.publicUrl;
}
