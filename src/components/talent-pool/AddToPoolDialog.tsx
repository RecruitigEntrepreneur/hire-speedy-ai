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
import { useTranslation } from 'react-i18next';

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

export function AddToPoolDialog({
  candidateId,
  candidateName,
  submissionId,
  skills,
  experienceYears,
  trigger,
}: AddToPoolDialogProps) {
  const { t } = useTranslation('talentPool');
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
            {t('add.button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('add.title')}</DialogTitle>
          <DialogDescription>
            {t('add.description', { name: candidateName })}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="pool_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('add.category')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('add.categoryPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {t('typeOption.general')}
                        </div>
                      </SelectItem>
                      <SelectItem value="silver_medalist">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500" />
                          {t('typeOption.silver_medalist')}
                        </div>
                      </SelectItem>
                      <SelectItem value="future_fit">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-blue-500" />
                          {t('typeOption.future_fit')}
                        </div>
                      </SelectItem>
                      <SelectItem value="passive">
                        <div className="flex items-center gap-2">
                          <Coffee className="h-4 w-4 text-purple-500" />
                          {t('typeOption.passive')}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(`typeHint.${field.value}`)}
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
                  <FormLabel>{t('add.reason')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('add.reasonPlaceholder')}
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
                  <FormLabel>{t('add.frequency')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">{t('add.monthly')}</SelectItem>
                      <SelectItem value="quarterly">{t('add.quarterly')}</SelectItem>
                      <SelectItem value="yearly">{t('add.yearly')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('add.frequencyHint')}
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
                  <FormLabel>{t('add.availability')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('add.availabilityPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="immediate">{t('availabilityOption.immediate')}</SelectItem>
                      <SelectItem value="2_weeks">{t('availabilityOption.2_weeks')}</SelectItem>
                      <SelectItem value="1_month">{t('availabilityOption.1_month')}</SelectItem>
                      <SelectItem value="3_months">{t('availabilityOption.3_months')}</SelectItem>
                      <SelectItem value="passive">{t('availabilityOption.passive')}</SelectItem>
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
                  <FormLabel>{t('add.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('add.notesPlaceholder')}
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
                {t('add.cancel')}
              </Button>
              <Button type="submit" disabled={addToPool.isPending}>
                {addToPool.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('add.submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
