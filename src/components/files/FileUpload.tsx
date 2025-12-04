import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, File, X, Loader2, CheckCircle } from 'lucide-react';

interface FileUploadProps {
  bucket?: string;
  folder?: string;
  accept?: string;
  maxSize?: number; // in MB
  onUploadComplete?: (url: string, path: string) => void;
  label?: string;
  existingUrl?: string;
}

export function FileUpload({
  bucket = 'documents',
  folder = 'uploads',
  accept = '.pdf,.doc,.docx',
  maxSize = 10,
  onUploadComplete,
  label = 'Datei hochladen',
  existingUrl,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`Datei zu groß. Maximale Größe: ${maxSize}MB`);
      return;
    }

    setUploading(true);
    setFileName(file.name);

    try {
      // Get user ID for folder structure
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Nicht angemeldet');
      }

      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const filePath = `${folder}/${user.id}/${timestamp}.${fileExt}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get signed URL (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600);

      if (urlError) {
        throw urlError;
      }

      setUploadedUrl(urlData.signedUrl);
      onUploadComplete?.(urlData.signedUrl, filePath);
      toast.success('Datei erfolgreich hochgeladen');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Fehler beim Hochladen der Datei');
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setUploadedUrl(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {uploadedUrl ? (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {fileName || 'Datei hochgeladen'}
            </p>
            <a 
              href={uploadedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Datei ansehen
            </a>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`
              flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed 
              rounded-lg cursor-pointer transition-colors
              ${uploading 
                ? 'bg-muted cursor-not-allowed' 
                : 'hover:bg-muted/50 hover:border-primary'}
            `}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Wird hochgeladen...
                </span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Klicken zum Hochladen oder Datei hierher ziehen
                </span>
                <span className="text-xs text-muted-foreground">
                  {accept.replace(/\./g, '').toUpperCase()} • Max. {maxSize}MB
                </span>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
