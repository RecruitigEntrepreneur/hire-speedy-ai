import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateOffer, useSendOffer } from '@/hooks/useOffers';
import { Loader2, Send, Save, Euro, Calendar, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const offerSchema = z.object({
  salary_offered: z.number().min(1, 'Gehalt ist erforderlich'),
  salary_currency: z.string().default('EUR'),
  bonus_amount: z.number().optional(),
  equity_percentage: z.number().optional(),
  benefits: z.string().optional(),
  start_date: z.string().optional(),
  contract_type: z.string().default('permanent'),
  probation_months: z.number().default(6),
  remote_policy: z.string().optional(),
  location: z.string().optional(),
  custom_terms: z.string().optional(),
  expires_in_days: z.number().default(7),
});

type OfferFormData = z.infer<typeof offerSchema>;

interface OfferCreationFormProps {
  open: boolean;
  onClose: () => void;
  submissionId: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
}

export function OfferCreationForm({
  open,
  onClose,
  submissionId,
  candidateName,
  jobTitle,
  companyName,
}: OfferCreationFormProps) {
  const [step, setStep] = useState<'form' | 'preview'>('form');
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null);
  
  const createOffer = useCreateOffer();
  const sendOffer = useSendOffer();

  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      salary_currency: 'EUR',
      contract_type: 'permanent',
      probation_months: 6,
      expires_in_days: 7,
    },
  });

  const watchedValues = form.watch();

  const handleSaveDraft = async () => {
    const values = form.getValues();
    const benefitsArray = values.benefits 
      ? values.benefits.split(',').map(b => b.trim()).filter(Boolean)
      : [];

    try {
      const result = await createOffer.mutateAsync({
        submission_id: submissionId,
        salary_offered: values.salary_offered,
        salary_currency: values.salary_currency,
        bonus_amount: values.bonus_amount,
        equity_percentage: values.equity_percentage,
        benefits: benefitsArray,
        start_date: values.start_date,
        contract_type: values.contract_type,
        probation_months: values.probation_months,
        remote_policy: values.remote_policy,
        location: values.location,
        custom_terms: values.custom_terms,
        expires_in_days: values.expires_in_days,
      });
      
      setCreatedOfferId(result.offer.id);
      setStep('preview');
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleSendOffer = async () => {
    if (!createdOfferId) return;
    
    try {
      await sendOffer.mutateAsync({ offerId: createdOfferId });
      onClose();
      setStep('form');
      setCreatedOfferId(null);
      form.reset();
    } catch (error) {
      console.error('Error sending offer:', error);
    }
  };

  const handleClose = () => {
    onClose();
    setStep('form');
    setCreatedOfferId(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'form' ? 'Angebot erstellen' : 'Angebot prüfen & senden'}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{candidateName}</span> für{' '}
            <span className="font-medium">{jobTitle}</span> bei{' '}
            <span className="font-medium">{companyName}</span>
          </div>
        </DialogHeader>

        {step === 'form' ? (
          <Form {...form}>
            <form className="space-y-6">
              {/* Gehalt Section */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Euro className="h-4 w-4" /> Vergütung
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="salary_offered"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jahresgehalt *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="80000"
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salary_currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Währung</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bonus_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="10000"
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="equity_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Equity % (optional)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.5"
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Vertrag Section */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Vertragsdetails
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contract_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vertragsart</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="permanent">Unbefristet</SelectItem>
                            <SelectItem value="fixed">Befristet</SelectItem>
                            <SelectItem value="freelance">Freiberuflich</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Startdatum</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="probation_months"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Probezeit (Monate)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || 6)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="remote_policy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Remote-Regelung</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Auswählen..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="onsite">Vor Ort</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                            <SelectItem value="remote">Full Remote</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standort</FormLabel>
                      <FormControl>
                        <Input placeholder="Berlin, Deutschland" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Benefits Section */}
              <FormField
                control={form.control}
                name="benefits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benefits (kommagetrennt)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="30 Tage Urlaub, Firmenwagen, Weiterbildungsbudget, Fitnessstudio"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Trennen Sie mehrere Benefits mit Kommas
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* Custom Terms */}
              <FormField
                control={form.control}
                name="custom_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zusätzliche Bedingungen (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Weitere Vereinbarungen oder Bedingungen..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Gültigkeit */}
              <FormField
                control={form.control}
                name="expires_in_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gültigkeit (Tage)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 7)}
                      />
                    </FormControl>
                    <FormDescription>
                      Das Angebot läuft nach dieser Anzahl Tagen ab
                    </FormDescription>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Abbrechen
                </Button>
                <Button 
                  type="button" 
                  onClick={handleSaveDraft}
                  disabled={createOffer.isPending || !form.watch('salary_offered')}
                >
                  {createOffer.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Weiter zur Vorschau
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-lg">{jobTitle}</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Jahresgehalt:</span>
                  <p className="font-semibold text-lg">
                    {watchedValues.salary_offered?.toLocaleString('de-DE')} {watchedValues.salary_currency}
                  </p>
                </div>
                {watchedValues.bonus_amount && (
                  <div>
                    <span className="text-muted-foreground">Bonus:</span>
                    <p className="font-medium">{watchedValues.bonus_amount?.toLocaleString('de-DE')} {watchedValues.salary_currency}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Vertragsart:</span>
                  <p className="font-medium">
                    {watchedValues.contract_type === 'permanent' ? 'Unbefristet' : 
                     watchedValues.contract_type === 'fixed' ? 'Befristet' : 'Freiberuflich'}
                  </p>
                </div>
                {watchedValues.start_date && (
                  <div>
                    <span className="text-muted-foreground">Startdatum:</span>
                    <p className="font-medium">{new Date(watchedValues.start_date).toLocaleDateString('de-DE')}</p>
                  </div>
                )}
                {watchedValues.remote_policy && (
                  <div>
                    <span className="text-muted-foreground">Remote:</span>
                    <p className="font-medium">
                      {watchedValues.remote_policy === 'onsite' ? 'Vor Ort' :
                       watchedValues.remote_policy === 'hybrid' ? 'Hybrid' : 'Full Remote'}
                    </p>
                  </div>
                )}
                {watchedValues.location && (
                  <div>
                    <span className="text-muted-foreground">Standort:</span>
                    <p className="font-medium">{watchedValues.location}</p>
                  </div>
                )}
              </div>

              {watchedValues.benefits && (
                <div>
                  <span className="text-muted-foreground text-sm">Benefits:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {watchedValues.benefits.split(',').map((benefit, i) => (
                      <Badge key={i} variant="secondary">{benefit.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {watchedValues.custom_terms && (
                <div>
                  <span className="text-muted-foreground text-sm">Zusätzliche Bedingungen:</span>
                  <p className="text-sm mt-1">{watchedValues.custom_terms}</p>
                </div>
              )}

              <div className="text-sm text-amber-600">
                ⏰ Gültig für {watchedValues.expires_in_days} Tage nach Versand
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep('form')}>
                Zurück zur Bearbeitung
              </Button>
              <Button 
                onClick={handleSendOffer}
                disabled={sendOffer.isPending}
                className="gap-2"
              >
                {sendOffer.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Angebot senden
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
