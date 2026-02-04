import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_type: 'cv' | 'cv_anonymized' | 'certificate' | 'portfolio' | 'reference';
  version: number;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  is_current: boolean;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useCandidateDocuments(candidateId?: string) {
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Helper function to generate signed URLs for private bucket
  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('cv-documents')
        .createSignedUrl(filePath, 3600); // 1 hour validity
      
      if (error) {
        console.error('Error creating signed URL:', error);
        return null;
      }
      return data.signedUrl;
    } catch (err) {
      console.error('Error in getSignedUrl:', err);
      return null;
    }
  };

  const fetchDocuments = useCallback(async () => {
    if (!candidateId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('document_type')
        .order('version', { ascending: false });

      if (error) throw error;
      
      // Generate signed URLs for all documents (private bucket)
      const docsWithSignedUrls = await Promise.all(
        (data || []).map(async (doc) => {
          // Extract path from stored URL
          const urlPath = doc.file_url.split('/cv-documents/')[1];
          if (urlPath) {
            const signedUrl = await getSignedUrl(decodeURIComponent(urlPath));
            return { ...doc, file_url: signedUrl || doc.file_url };
          }
          return doc;
        })
      );
      
      setDocuments(docsWithSignedUrls as CandidateDocument[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    documentType: CandidateDocument['document_type'],
    notes?: string
  ) => {
    if (!candidateId || !user) return null;

    setUploading(true);
    try {
      // Get the current max version for this document type
      const existingDocs = documents.filter(d => d.document_type === documentType);
      const maxVersion = existingDocs.length > 0 
        ? Math.max(...existingDocs.map(d => d.version)) 
        : 0;
      const newVersion = maxVersion + 1;

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${candidateId}/${documentType}_v${newVersion}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('cv-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('cv-documents')
        .getPublicUrl(fileName);

      // Mark previous versions as not current
      if (existingDocs.length > 0) {
        await supabase
          .from('candidate_documents')
          .update({ is_current: false })
          .eq('candidate_id', candidateId)
          .eq('document_type', documentType);
      }

      // Insert document record
      const { data, error } = await supabase
        .from('candidate_documents')
        .insert({
          candidate_id: candidateId,
          document_type: documentType,
          version: newVersion,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          mime_type: file.type,
          is_current: true,
          notes,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Dokument hochgeladen',
        description: `${file.name} wurde erfolgreich hochgeladen (Version ${newVersion}).`,
      });

      await fetchDocuments();
      return data as CandidateDocument;
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Upload fehlgeschlagen',
        description: 'Das Dokument konnte nicht hochgeladen werden.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('candidate_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast({
        title: 'Dokument gelöscht',
        description: 'Das Dokument wurde erfolgreich gelöscht.',
      });

      await fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Löschen fehlgeschlagen',
        description: 'Das Dokument konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const getCurrentDocuments = () => {
    return documents.filter(d => d.is_current);
  };

  const getDocumentsByType = (type: CandidateDocument['document_type']) => {
    return documents.filter(d => d.document_type === type);
  };

  return {
    documents,
    loading,
    uploading,
    refetch: fetchDocuments,
    uploadDocument,
    deleteDocument,
    getCurrentDocuments,
    getDocumentsByType,
  };
}
