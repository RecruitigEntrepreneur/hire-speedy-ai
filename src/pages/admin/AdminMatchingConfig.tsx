import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, RotateCcw, Settings, Target, Shield, Sliders } from 'lucide-react';
import { toast } from 'sonner';

interface MatchingConfig {
  id: string;
  name: string;
  version: string;
  active: boolean;
  weights: {
    fit: number;
    constraints: number;
    fit_breakdown: {
      skills: number;
      experience: number;
      industry: number;
    };
    constraint_breakdown: {
      salary: number;
      commute: number;
      startDate: number;
    };
  };
  gate_thresholds: {
    salary_warn_percent: number;
    salary_fail_percent: number;
    commute_warn_minutes: number;
    commute_fail_minutes: number;
    availability_warn_days: number;
    availability_fail_days: number;
    min_skill_match_percent: number;
  };
  hard_kill_defaults: {
    visa_required: boolean;
    language_required: boolean;
    onsite_required: boolean;
    license_required: boolean;
  };
  display_policies: {
    hot: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    standard: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    maybe: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
  };
  dealbreaker_multipliers: {
    salary: { min: number; max: number; multiplier: number }[];
    seniority: { gap: number; multiplier: number }[];
    start_date: { min: number; max: number; multiplier: number }[];
  };
}

export default function AdminMatchingConfig() {
  const [config, setConfig] = useState<MatchingConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<MatchingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('matching_config')
      .select('*')
      .eq('active', true)
      .single();

    if (error) {
      toast.error('Fehler beim Laden der Konfiguration');
      console.error(error);
      setLoading(false);
      return;
    }
    
    const configData = data as unknown as MatchingConfig;
    setConfig(configData);
    setOriginalConfig(JSON.parse(JSON.stringify(configData)));
    setLoading(false);
  };

  const handleMainWeightChange = (fitPercent: number) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weights: {
          ...prev.weights,
          fit: fitPercent / 100,
          constraints: 1 - fitPercent / 100
        }
      };
    });
    setHasChanges(true);
  };

  const handleFitBreakdownChange = (key: keyof MatchingConfig['weights']['fit_breakdown'], value: number) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weights: {
          ...prev.weights,
          fit_breakdown: {
            ...prev.weights.fit_breakdown,
            [key]: value / 100
          }
        }
      };
    });
    setHasChanges(true);
  };

  const handleConstraintBreakdownChange = (key: keyof MatchingConfig['weights']['constraint_breakdown'], value: number) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        weights: {
          ...prev.weights,
          constraint_breakdown: {
            ...prev.weights.constraint_breakdown,
            [key]: value / 100
          }
        }
      };
    });
    setHasChanges(true);
  };

  const handleGateThresholdChange = (key: keyof MatchingConfig['gate_thresholds'], value: number) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        gate_thresholds: {
          ...prev.gate_thresholds,
          [key]: value
        }
      };
    });
    setHasChanges(true);
  };

  const handleHardKillChange = (key: keyof MatchingConfig['hard_kill_defaults'], value: boolean) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        hard_kill_defaults: {
          ...prev.hard_kill_defaults,
          [key]: value
        }
      };
    });
    setHasChanges(true);
  };

  const handlePolicyChange = (tier: 'hot' | 'standard' | 'maybe', key: 'minScore' | 'minCoverage', value: number) => {
    if (!config) return;
    
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        display_policies: {
          ...prev.display_policies,
          [tier]: {
            ...prev.display_policies[tier],
            [key]: key === 'minCoverage' ? value / 100 : value
          }
        }
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    const { error } = await supabase
      .from('matching_config')
      .update({
        weights: config.weights,
        gate_thresholds: config.gate_thresholds,
        hard_kill_defaults: config.hard_kill_defaults,
        display_policies: config.display_policies,
        dealbreaker_multipliers: config.dealbreaker_multipliers,
        updated_at: new Date().toISOString()
      })
      .eq('id', config.id);

    setSaving(false);
    
    if (error) {
      toast.error('Fehler beim Speichern');
      console.error(error);
      return;
    }
    
    toast.success('Konfiguration gespeichert');
    setOriginalConfig(JSON.parse(JSON.stringify(config)));
    setHasChanges(false);
  };

  const handleReset = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)));
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!config) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Keine Konfiguration gefunden</p>
        </div>
      </DashboardLayout>
    );
  }

  const fitTotal = Object.values(config.weights.fit_breakdown).reduce((a, b) => a + b, 0);
  const constraintTotal = Object.values(config.weights.constraint_breakdown).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Matching Konfiguration</h1>
            <p className="text-muted-foreground">
              Gewichtungen und Schwellenwerte für den Matching-Algorithmus V3.1
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Zurücksetzen
              </Button>
            )}
            <Button onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Speichern
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">{config.name}</Badge>
          <Badge variant="secondary">{config.version}</Badge>
          {config.active && <Badge className="bg-green-500">Aktiv</Badge>}
        </div>

        <Tabs defaultValue="weights" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="weights" className="flex items-center gap-1">
              <Sliders className="h-3 w-3" />
              Gewichte
            </TabsTrigger>
            <TabsTrigger value="gates" className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              Gates
            </TabsTrigger>
            <TabsTrigger value="hardkills" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Hard Kills
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Policies
            </TabsTrigger>
          </TabsList>

          {/* WEIGHTS TAB */}
          <TabsContent value="weights" className="space-y-6">
            {/* Main Weight Balance */}
            <Card>
              <CardHeader>
                <CardTitle>Haupt-Gewichtung</CardTitle>
                <CardDescription>
                  Balance zwischen Fit (Skills, Erfahrung) und Constraints (Gehalt, Standort)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Fit: {Math.round(config.weights.fit * 100)}%</span>
                    <span className="font-medium">Constraints: {Math.round(config.weights.constraints * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round(config.weights.fit * 100)]}
                    onValueChange={(v) => handleMainWeightChange(v[0])}
                    min={30}
                    max={90}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Fit = Skills + Erfahrung + Branche | Constraints = Gehalt + Pendelzeit + Startdatum
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Fit Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Fit-Gewichtung
                    <Badge variant={Math.abs(fitTotal - 1) < 0.01 ? 'default' : 'destructive'}>
                      Summe: {Math.round(fitTotal * 100)}%
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Wie wichtig sind die einzelnen Fit-Faktoren?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Skills */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Skills</Label>
                      <span className="font-medium">{Math.round(config.weights.fit_breakdown.skills * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.fit_breakdown.skills * 100)]}
                      onValueChange={(v) => handleFitBreakdownChange('skills', v[0])}
                      min={10}
                      max={80}
                      step={5}
                    />
                  </div>
                  
                  {/* Experience */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Erfahrung (Jahre)</Label>
                      <span className="font-medium">{Math.round(config.weights.fit_breakdown.experience * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.fit_breakdown.experience * 100)]}
                      onValueChange={(v) => handleFitBreakdownChange('experience', v[0])}
                      min={5}
                      max={50}
                      step={5}
                    />
                  </div>
                  
                  {/* Industry */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Branche</Label>
                      <span className="font-medium">{Math.round(config.weights.fit_breakdown.industry * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.fit_breakdown.industry * 100)]}
                      onValueChange={(v) => handleFitBreakdownChange('industry', v[0])}
                      min={0}
                      max={40}
                      step={5}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Constraint Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Constraint-Gewichtung
                    <Badge variant={Math.abs(constraintTotal - 1) < 0.01 ? 'default' : 'destructive'}>
                      Summe: {Math.round(constraintTotal * 100)}%
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Gewichtung der einschränkenden Faktoren
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Salary */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Gehalt</Label>
                      <span className="font-medium">{Math.round(config.weights.constraint_breakdown.salary * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.constraint_breakdown.salary * 100)]}
                      onValueChange={(v) => handleConstraintBreakdownChange('salary', v[0])}
                      min={10}
                      max={70}
                      step={5}
                    />
                  </div>
                  
                  {/* Commute */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Pendelzeit</Label>
                      <span className="font-medium">{Math.round(config.weights.constraint_breakdown.commute * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.constraint_breakdown.commute * 100)]}
                      onValueChange={(v) => handleConstraintBreakdownChange('commute', v[0])}
                      min={10}
                      max={60}
                      step={5}
                    />
                  </div>
                  
                  {/* Start Date */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <Label>Startdatum</Label>
                      <span className="font-medium">{Math.round(config.weights.constraint_breakdown.startDate * 100)}%</span>
                    </div>
                    <Slider
                      value={[Math.round(config.weights.constraint_breakdown.startDate * 100)]}
                      onValueChange={(v) => handleConstraintBreakdownChange('startDate', v[0])}
                      min={5}
                      max={50}
                      step={5}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* GATES TAB */}
          <TabsContent value="gates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Gate-Schwellenwerte</CardTitle>
                <CardDescription>
                  Ab welchen Werten werden Warnungen oder Ausschlüsse ausgelöst?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Salary Gates */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Gehalts-Abweichung</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-amber-600">Warnung ab (%)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.salary_warn_percent}
                          onChange={(e) => handleGateThresholdChange('salary_warn_percent', parseInt(e.target.value) || 0)}
                          min={0}
                          max={50}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-destructive">Ausschluss ab (%)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.salary_fail_percent}
                          onChange={(e) => handleGateThresholdChange('salary_fail_percent', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Commute Gates */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Pendelzeit</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-amber-600">Warnung ab (Min)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.commute_warn_minutes}
                          onChange={(e) => handleGateThresholdChange('commute_warn_minutes', parseInt(e.target.value) || 0)}
                          min={0}
                          max={120}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-destructive">Ausschluss ab (Min)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.commute_fail_minutes}
                          onChange={(e) => handleGateThresholdChange('commute_fail_minutes', parseInt(e.target.value) || 0)}
                          min={0}
                          max={180}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Availability Gates */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Verfügbarkeit</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-amber-600">Warnung ab (Tage)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.availability_warn_days}
                          onChange={(e) => handleGateThresholdChange('availability_warn_days', parseInt(e.target.value) || 0)}
                          min={0}
                          max={180}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-destructive">Ausschluss ab (Tage)</Label>
                        <Input
                          type="number"
                          value={config.gate_thresholds.availability_fail_days}
                          onChange={(e) => handleGateThresholdChange('availability_fail_days', parseInt(e.target.value) || 0)}
                          min={0}
                          max={365}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Skill Match */}
                  <div className="space-y-4">
                    <h3 className="font-semibold">Skill-Match</h3>
                    <div className="space-y-2">
                      <Label className="text-xs">Mindest-Übereinstimmung (%)</Label>
                      <Input
                        type="number"
                        value={config.gate_thresholds.min_skill_match_percent}
                        onChange={(e) => handleGateThresholdChange('min_skill_match_percent', parseInt(e.target.value) || 0)}
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HARD KILLS TAB */}
          <TabsContent value="hardkills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hard Kill Einstellungen</CardTitle>
                <CardDescription>
                  Welche Kriterien führen zum sofortigen Ausschluss eines Kandidaten?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Visa */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Arbeitserlaubnis erforderlich</Label>
                      <p className="text-sm text-muted-foreground">
                        Kandidaten ohne passende Arbeitserlaubnis werden ausgeschlossen
                      </p>
                    </div>
                    <Switch
                      checked={config.hard_kill_defaults.visa_required}
                      onCheckedChange={(v) => handleHardKillChange('visa_required', v)}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Language */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Sprachanforderungen prüfen</Label>
                      <p className="text-sm text-muted-foreground">
                        Kandidaten ohne erforderliche Sprachkenntnisse werden ausgeschlossen
                      </p>
                    </div>
                    <Switch
                      checked={config.hard_kill_defaults.language_required}
                      onCheckedChange={(v) => handleHardKillChange('language_required', v)}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Onsite */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Vor-Ort-Präsenz prüfen</Label>
                      <p className="text-sm text-muted-foreground">
                        Remote-Only Kandidaten werden für Vor-Ort-Jobs ausgeschlossen
                      </p>
                    </div>
                    <Switch
                      checked={config.hard_kill_defaults.onsite_required}
                      onCheckedChange={(v) => handleHardKillChange('onsite_required', v)}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* License */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Zertifizierungen prüfen</Label>
                      <p className="text-sm text-muted-foreground">
                        Kandidaten ohne erforderliche Zertifizierungen werden ausgeschlossen
                      </p>
                    </div>
                    <Switch
                      checked={config.hard_kill_defaults.license_required}
                      onCheckedChange={(v) => handleHardKillChange('license_required', v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* POLICIES TAB */}
          <TabsContent value="policies" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Policy-Schwellenwerte</CardTitle>
                <CardDescription>
                  Ab welchen Scores werden Kandidaten in welche Kategorie eingestuft?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Hot */}
                  <div className="space-y-4 p-4 rounded-lg border border-green-200 bg-green-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🔥</span>
                      <h3 className="font-semibold text-green-700">Hot Match</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Score</Label>
                        <Input
                          type="number"
                          value={config.display_policies.hot.minScore}
                          onChange={(e) => handlePolicyChange('hot', 'minScore', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Coverage (%)</Label>
                        <Input
                          type="number"
                          value={Math.round(config.display_policies.hot.minCoverage * 100)}
                          onChange={(e) => handlePolicyChange('hot', 'minCoverage', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Standard */}
                  <div className="space-y-4 p-4 rounded-lg border border-blue-200 bg-blue-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✓</span>
                      <h3 className="font-semibold text-blue-700">Standard</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Score</Label>
                        <Input
                          type="number"
                          value={config.display_policies.standard.minScore}
                          onChange={(e) => handlePolicyChange('standard', 'minScore', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Coverage (%)</Label>
                        <Input
                          type="number"
                          value={Math.round(config.display_policies.standard.minCoverage * 100)}
                          onChange={(e) => handlePolicyChange('standard', 'minCoverage', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Maybe */}
                  <div className="space-y-4 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">?</span>
                      <h3 className="font-semibold text-amber-700">Vielleicht</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Min Score</Label>
                        <Input
                          type="number"
                          value={config.display_policies.maybe.minScore}
                          onChange={(e) => handlePolicyChange('maybe', 'minScore', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Coverage (%)</Label>
                        <Input
                          type="number"
                          value={Math.round(config.display_policies.maybe.minCoverage * 100)}
                          onChange={(e) => handlePolicyChange('maybe', 'minCoverage', parseInt(e.target.value) || 0)}
                          min={0}
                          max={100}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Kandidaten unter dem "Vielleicht"-Schwellenwert werden als "Hidden" eingestuft und nicht angezeigt.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
