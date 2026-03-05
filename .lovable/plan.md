

## RLS Policy fuer candidate_experiences hinzufuegen

Eine neue RLS Policy wird erstellt, die Clients erlaubt, die Berufserfahrungen von Kandidaten einzusehen, die fuer ihre Jobs eingereicht wurden.

### SQL Migration

```sql
CREATE POLICY "Clients can view experiences for submitted candidates"
ON public.candidate_experiences FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.submissions s
  JOIN public.jobs j ON j.id = s.job_id
  WHERE s.candidate_id = candidate_experiences.candidate_id
  AND j.client_id = auth.uid()
));
```

### Hinweis
- Die Policy ist sicher: sie prueft ueber `submissions` und `jobs`, ob der eingeloggte Client (`auth.uid()`) tatsaechlich Jobs besitzt, fuer die der Kandidat eingereicht wurde.
- Keine Rekursionsgefahr, da die Subquery auf `submissions` und `jobs` zugreift, nicht auf `candidate_experiences` selbst.
- Keine Code-Aenderungen noetig -- die bestehende `CandidateExperienceTimeline` Komponente liest bereits aus `candidate_experiences`.

