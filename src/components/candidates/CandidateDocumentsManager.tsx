import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  ChevronDown,
  File,
  Award,
  Briefcase,
  Eye,
  Clock
} from 'lucide-react';
import { useCandidateDocuments, CandidateDocument } from '@/hooks/useCandidateDocuments';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface CandidateDocumentsManagerProps {
  candidateId: string;
}

const documentTypeLabels: Record<CandidateDocument['document_type'], { label: string; icon: typeof FileText }> = {
  cv: { label: 'Lebenslauf', icon: FileText },
  cv_anonymized: { label: 'Anonymisierter CV', icon: FileText },
  certificate: { label: 'Zertifikat', icon: Award },
  portfolio: { label: 'Portfolio', icon: Briefcase },
  reference: { label: 'Referenz', icon: File },
};

export function CandidateDocumentsManager({ candidateId }: CandidateDocumentsManagerProps) {
  const {
    documents,
    loading,
    uploading,
    uploadDocument,
    deleteDocument,
    getDocumentsByType,
  } = useCandidateDocuments(candidateId);

  const [selectedType, setSelectedType] = useState<CandidateDocument['document_type']>('cv');
  const [expandedTypes, setExpandedTypes] = useState<string[]>(['cv']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadDocument(file, selectedType);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleExpanded = (type: string) => {
    setExpandedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unbekannt';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const documentTypes: CandidateDocument['document_type'][] = ['cv', 'cv_anonymized', 'certificate', 'portfolio', 'reference'];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Dokumente werden geladen...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Dokumentenverwaltung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="flex items-end gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1 space-y-2">
            <Label>Dokumenttyp</Label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as CandidateDocument['document_type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {documentTypeLabels[type].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Hochladen...' : 'Hochladen'}
            </Button>
          </div>
        </div>

        {/* Document List by Type */}
        <div className="space-y-2">
          {documentTypes.map(type => {
            const typeDocs = getDocumentsByType(type);
            if (typeDocs.length === 0) return null;

            const Icon = documentTypeLabels[type].icon;
            const currentDoc = typeDocs.find(d => d.is_current);

            return (
              <Collapsible
                key={type}
                open={expandedTypes.includes(type)}
                onOpenChange={() => toggleExpanded(type)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{documentTypeLabels[type].label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {typeDocs.length} Version{typeDocs.length !== 1 ? 'en' : ''}
                      </Badge>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedTypes.includes(type) ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-7">
                    {typeDocs.map(doc => (
                      <div
                        key={doc.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          doc.is_current ? 'border-primary/30 bg-primary/5' : 'border-border'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{doc.file_name}</span>
                              {doc.is_current && (
                                <Badge variant="default" className="text-xs">Aktuell</Badge>
                              )}
                              <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{formatFileSize(doc.file_size)}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(doc.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(doc.file_url, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = doc.file_url;
                              link.download = doc.file_name;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {documents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Noch keine Dokumente hochgeladen</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
