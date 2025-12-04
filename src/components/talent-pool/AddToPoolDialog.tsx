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
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
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
import { useTalentPool } from '@/hooks/useTalentPool';
import { UserPlus, Loader2, Star, Clock, Coffee, Users } from 'lucide-react';

const poolSchema = z.object({
  pool_type: z.enum(['general', 'silver_medalist', 'future_fit', 'passive']),
  added_reason: z.string().optional(),
  contact_frequency: z.enum(['monthly', 'quarterly', 'yearly']),
  availability: z.enum(['immediate', '2_weeks', '1_month', '3_months', 'passive']).optional(),
  notes: z.string().optional(),
});

type PoolFormData = z.infer<typeof poolSchema>;

interface AddToPoolDialogProps {
  candidateId: string;
  candidateName: string;
  submissionId?: string;
  skills?: string[];
  experienceYears?: number;
  trigger?: React.ReactNode;
}

const poolTypeDescriptions = {
  general: 'Allgemeiner Kandidatenpool',
  silver_medalist: 'War auf Platz 2 oder 3, sehr gut qualifiziert',
  future_fit: 'Noch nicht bereit, aber großes Potenzial',
  passive: 'Aktuell nicht aktiv suchend',
};

export function AddToPoolDialog({
  candidateId,
  candidateName,
  submissionId,
  skills,
  experienceYears,
  trigger,
}: AddToPoolDialogProps) {
  const [open, setOpen] = useState(false);
  const { addToPool } = useTalentPool();

  const form = useForm<PoolFormData>({
    resolver: zodResolver(poolSchema),
    defaultValues: {
      pool_type: 'general',
      contact_frequency: 'quarterly',
    },
  });

  const onSubmit = async (data: PoolFormData) => {
    await addToPool.mutateAsync({
      candidate_id: candidateId,
      source_submission_id: submissionId,
      skills_snapshot: skills,
      experience_years: experienceYears,
      ...data,
    });
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Zum Pool hinzufügen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Zum Talent Pool hinzufügen</DialogTitle>
          <DialogDescription>
            {candidateName} für zukünftige Positionen vormerken
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pool_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kategorie</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kategorie wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Allgemein
                        </div>
                      </SelectItem>
                      <SelectItem value="silver_medalist">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500" />
                          Silber-Medaillist
                        </div>
                      </SelectItem>
                      <SelectItem value="future_fit">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          Future Fit
                        </div>
                      </SelectItem>
                      <SelectItem value="passive">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-purple-500" />
                          Passiv
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {poolTypeDescriptions[field.value]}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="added_reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grund für Aufnahme</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z.B. Sehr guter Kandidat, aber Position besetzt"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontakt-Frequenz</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Monatlich</SelectItem>
                      <SelectItem value="quarterly">Vierteljährlich</SelectItem>
                      <SelectItem value="yearly">Jährlich</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Wie oft soll an Kontaktaufnahme erinnert werden?
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verfügbarkeit</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Verfügbarkeit wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="immediate">Sofort verfügbar</SelectItem>
                      <SelectItem value="2_weeks">In 2 Wochen</SelectItem>
                      <SelectItem value="1_month">In 1 Monat</SelectItem>
                      <SelectItem value="3_months">In 3 Monaten</SelectItem>
                      <SelectItem value="passive">Nicht aktiv suchend</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Weitere Notizen zum Kandidaten..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
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
              <Button type="submit" disabled={addToPool.isPending}>
                {addToPool.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Hinzufügen
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
