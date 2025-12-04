import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useReferenceRequests } from '@/hooks/useReferenceChecks';
import { ClipboardCheck, Loader2 } from 'lucide-react';

const referenceSchema = z.object({
  reference_name: z.string().min(2, 'Name erforderlich'),
  reference_email: z.string().email('Ungültige E-Mail-Adresse'),
  reference_phone: z.string().optional(),
  reference_company: z.string().optional(),
  reference_position: z.string().optional(),
  relationship: z.enum(['manager', 'colleague', 'report', 'client']).optional(),
});

type ReferenceFormData = z.infer<typeof referenceSchema>;

interface RequestReferenceDialogProps {
  submissionId: string;
  candidateId: string;
  candidateName: string;
  trigger?: React.ReactNode;
}

const relationshipLabels = {
  manager: 'Vorgesetzter',
  colleague: 'Kollege',
  report: 'Direkter Mitarbeiter',
  client: 'Kunde',
};

export function RequestReferenceDialog({
  submissionId,
  candidateId,
  candidateName,
  trigger,
}: RequestReferenceDialogProps) {
  const [open, setOpen] = useState(false);
  const { requestReference } = useReferenceRequests(candidateId);

  const form = useForm<ReferenceFormData>({
    resolver: zodResolver(referenceSchema),
    defaultValues: {
      reference_name: '',
      reference_email: '',
      reference_phone: '',
      reference_company: '',
      reference_position: '',
    },
  });

  const onSubmit = async (data: ReferenceFormData) => {
    await requestReference.mutateAsync({
      submission_id: submissionId,
      candidate_id: candidateId,
      reference_name: data.reference_name,
      reference_email: data.reference_email,
      reference_phone: data.reference_phone,
      reference_company: data.reference_company,
      reference_position: data.reference_position,
      relationship: data.relationship,
    });
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Referenz anfordern
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Referenz anfordern</DialogTitle>
          <DialogDescription>
            Fordern Sie eine Referenz für {candidateName} an
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reference_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name der Referenz *</FormLabel>
                  <FormControl>
                    <Input placeholder="Max Mustermann" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail-Adresse *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="referenz@unternehmen.de"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefonnummer</FormLabel>
                  <FormControl>
                    <Input placeholder="+49 123 456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reference_company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unternehmen</FormLabel>
                    <FormControl>
                      <Input placeholder="Firma GmbH" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference_position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="CTO" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beziehung zum Kandidaten</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Beziehung wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(relationshipLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={requestReference.isPending}>
                {requestReference.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Anfrage senden
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
