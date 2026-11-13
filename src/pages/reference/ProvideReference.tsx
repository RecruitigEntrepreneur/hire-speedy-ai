import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useReferenceByToken, useSubmitReference } from '@/hooks/useReferenceChecks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, CheckCircle2, XCircle, Clock, Star } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

const referenceSchema = z.object({
  overall_performance: z.number().min(1).max(5),
  technical_skills: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  teamwork: z.number().min(1).max(5),
  reliability: z.number().min(1).max(5),
  leadership: z.number().min(1).max(5).optional(),
  strengths: z.array(z.string()).optional(),
  areas_for_improvement: z.array(z.string()).optional(),
  notable_achievements: z.string().optional(),
  working_style: z.string().optional(),
  would_rehire: z.boolean(),
  recommendation_level: z.enum(['strong_yes', 'yes', 'neutral', 'no', 'strong_no']),
  additional_comments: z.string().optional(),
});

type ReferenceFormData = z.infer<typeof referenceSchema>;

// Auswahlwerte: `value` wird so gespeichert (bleibt deutsch), angezeigt wird reference:provide.<liste>.<key>.
const strengthOptions = [
  { key: 'technical', value: 'Technische Kompetenz' },
  { key: 'problemSolving', value: 'Problemlösung' },
  { key: 'communication', value: 'Kommunikation' },
  { key: 'teamwork', value: 'Teamarbeit' },
  { key: 'initiative', value: 'Eigeninitiative' },
  { key: 'learning', value: 'Lernbereitschaft' },
  { key: 'reliability', value: 'Zuverlässigkeit' },
  { key: 'leadership', value: 'Führungsfähigkeiten' },
  { key: 'creativity', value: 'Kreativität' },
  { key: 'timeManagement', value: 'Zeitmanagement' },
] as const;

const improvementOptions = [
  { key: 'communication', value: 'Kommunikation' },
  { key: 'timeManagement', value: 'Zeitmanagement' },
  { key: 'delegation', value: 'Delegation' },
  { key: 'detail', value: 'Detailgenauigkeit' },
  { key: 'stress', value: 'Stressresistenz' },
  { key: 'flexibility', value: 'Flexibilität' },
  { key: 'technical', value: 'Technische Fähigkeiten' },
] as const;

const RATING_FIELDS = ['overall_performance', 'technical_skills', 'communication', 'teamwork', 'reliability', 'leadership'] as const;
const LEVELS = ['strong_yes', 'yes', 'neutral', 'no', 'strong_no'] as const;

export default function ProvideReference() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation('reference');
  const navigate = useNavigate();
  const { data: request, isLoading, error } = useReferenceByToken(token);
  const submitReference = useSubmitReference();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ReferenceFormData>({
    resolver: zodResolver(referenceSchema),
    defaultValues: {
      overall_performance: 3,
      technical_skills: 3,
      communication: 3,
      teamwork: 3,
      reliability: 3,
      leadership: 3,
      strengths: [],
      areas_for_improvement: [],
      notable_achievements: '',
      working_style: '',
      would_rehire: true,
      recommendation_level: 'yes',
      additional_comments: '',
    },
  });

  const onSubmit = async (data: ReferenceFormData) => {
    if (!token) return;
    
    await submitReference.mutateAsync({ token, ...data });
    setSubmitted(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">{t('provide.loading')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h3 className="mt-4 text-lg font-semibold">{t('provide.invalidTitle')}</h3>
            <p className="text-muted-foreground">
              {t('provide.invalidBody')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h3 className="mt-4 text-lg font-semibold">{t('provide.thanksTitle')}</h3>
            <p className="text-muted-foreground">
              {t('provide.thanksBody')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('provide.title')}</CardTitle>
            <CardDescription>
              <Trans t={t} i18nKey="provide.intro" values={{ name: request.candidates?.full_name ?? '' }} components={{ strong: <strong /> }} />
              <br />
              {t('provide.confidential')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Rating Fields */}
                <div className="space-y-6">
                  <h3 className="font-semibold">{t('provide.ratings')}</h3>
                  
                  {RATING_FIELDS.map((name) => ({ name, label: t(`provide.fields.${name}`) })).map((field) => (
                    <FormField
                      key={field.name}
                      control={form.control}
                      name={field.name as any}
                      render={({ field: formField }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>{field.label}</FormLabel>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => formField.onChange(value)}
                                  className="p-1"
                                >
                                  <Star
                                    className={`h-6 w-6 ${
                                      value <= formField.value
                                        ? 'fill-amber-400 text-amber-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                </button>
                              ))}
                              <span className="ml-2 text-sm font-medium w-4">
                                {formField.value}
                              </span>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>

                {/* Strengths */}
                <FormField
                  control={form.control}
                  name="strengths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.strengthsLabel')}</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {strengthOptions.map(({ key, value: strength }) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                          >
                            <Checkbox
                              checked={field.value?.includes(strength)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), strength]);
                                } else {
                                  field.onChange(field.value?.filter((s) => s !== strength));
                                }
                              }}
                            />
                            <span className="text-sm">{t(`provide.strengths.${key}`)}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Areas for improvement */}
                <FormField
                  control={form.control}
                  name="areas_for_improvement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.improvementLabel')}</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {improvementOptions.map(({ key, value: area }) => (
                          <label
                            key={key}
                            className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
                          >
                            <Checkbox
                              checked={field.value?.includes(area)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), area]);
                                } else {
                                  field.onChange(field.value?.filter((s) => s !== area));
                                }
                              }}
                            />
                            <span className="text-sm">{t(`provide.improvements.${key}`)}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notable achievements */}
                <FormField
                  control={form.control}
                  name="notable_achievements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.achievements')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('provide.achievementsPlaceholder')}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Working style */}
                <FormField
                  control={form.control}
                  name="working_style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.workingStyle')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('provide.workingStylePlaceholder')}
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Would rehire */}
                <FormField
                  control={form.control}
                  name="would_rehire"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.rehire')}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(v) => field.onChange(v === 'true')}
                          defaultValue={field.value ? 'true' : 'false'}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="true" id="rehire-yes" />
                            <Label htmlFor="rehire-yes">{t('provide.yes')}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="false" id="rehire-no" />
                            <Label htmlFor="rehire-no">{t('provide.no')}</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Recommendation level */}
                <FormField
                  control={form.control}
                  name="recommendation_level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.recommendation')}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="grid grid-cols-5 gap-2"
                        >
                          {LEVELS.map((value) => ({ value, label: t(`provide.levels.${value}`) })).map((option) => (
                            <div key={option.value} className="text-center">
                              <RadioGroupItem
                                value={option.value}
                                id={`rec-${option.value}`}
                                className="sr-only"
                              />
                              <Label
                                htmlFor={`rec-${option.value}`}
                                className={`block p-3 border rounded cursor-pointer hover:bg-muted ${
                                  field.value === option.value ? 'border-primary bg-primary/10' : ''
                                }`}
                              >
                                <span className="text-xs">{option.label}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Additional comments */}
                <FormField
                  control={form.control}
                  name="additional_comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('provide.comments')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('provide.commentsPlaceholder')}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={submitReference.isPending}
                >
                  {submitReference.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t('provide.submit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
