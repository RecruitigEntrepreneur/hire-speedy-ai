import { Badge } from "@/components/ui/badge";
import { Clock, Lock, CheckCircle, AlertTriangle, RotateCcw } from "lucide-react";

interface EscrowStatusBadgeProps {
  status: string;
  releaseDate?: string;
}

export function EscrowStatusBadge({ status, releaseDate }: EscrowStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          label: "Ausstehend",
          icon: Clock,
          className: "bg-muted text-muted-foreground border-border",
        };
      case "held":
        return {
          label: "In Escrow",
          icon: Lock,
          className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        };
      case "released":
        return {
          label: "Freigegeben",
          icon: CheckCircle,
          className: "bg-green-500/10 text-green-600 border-green-500/20",
        };
      case "disputed":
        return {
          label: "Dispute",
          icon: AlertTriangle,
          className: "bg-red-500/10 text-red-600 border-red-500/20",
        };
      case "refunded":
        return {
          label: "Erstattet",
          icon: RotateCcw,
          className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
        };
      default:
        return {
          label: status,
          icon: Clock,
          className: "bg-muted text-muted-foreground border-border",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatReleaseDate = () => {
    if (!releaseDate) return null;
    const date = new Date(releaseDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `Freigabe in ${diffDays} Tagen`;
    }
    return "Freigabe möglich";
  };

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
      {status === "held" && releaseDate && (
        <span className="text-xs text-muted-foreground">
          {formatReleaseDate()}
        </span>
      )}
    </div>
  );
}
