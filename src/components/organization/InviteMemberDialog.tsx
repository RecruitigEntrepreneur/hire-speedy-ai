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
import { useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { UserPlus, Loader2 } from 'lucide-react';

const inviteSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  role: z.enum(['admin', 'hiring_manager', 'viewer', 'finance']),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberDialogProps {
  organizationId: string;
}

const roleDescriptions: Record<string, string> = {
  admin: 'Vollzugriff auf alle Funktionen außer Inhaberrechte',
  hiring_manager: 'Kann Jobs und Kandidaten verwalten, Interviews planen',
  viewer: 'Kann Jobs und Kandidaten einsehen (nur lesen)',
  finance: 'Kann Rechnungen und Zahlungen verwalten',
};

export function InviteMemberDialog({ organizationId }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const { sendInvite } = useOrganizationInvites(organizationId);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'hiring_manager',
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    await sendInvite.mutateAsync({
      organization_id: organizationId,
      email: data.email,
      role: data.role,
    });
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Mitglied einladen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Teammitglied einladen</DialogTitle>
          <DialogDescription>
            Senden Sie eine Einladung an ein neues Teammitglied.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail-Adresse</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="kollege@unternehmen.de"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle auswählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                      <SelectItem value="viewer">Betrachter</SelectItem>
                      <SelectItem value="finance">Finanzen</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {roleDescriptions[field.value]}
                  </FormDescription>
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
              <Button type="submit" disabled={sendInvite.isPending}>
                {sendInvite.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Einladung senden
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
