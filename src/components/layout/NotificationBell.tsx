import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();
  const { role } = useAuth();

  const getNotificationLink = (notification: {
    related_type?: string | null;
    related_id?: string | null;
  }) => {
    if (!notification.related_type || !notification.related_id) return null;

    switch (notification.related_type) {
      case "submission":
        return role === "recruiter"
          ? `/recruiter/submissions`
          : `/dashboard/candidates`;
      case "job":
        return role === "recruiter"
          ? `/recruiter/jobs/${notification.related_id}`
          : `/dashboard/jobs/${notification.related_id}`;
      case "interview":
        return role === "recruiter"
          ? `/recruiter/submissions`
          : `/dashboard/interviews`;
      case "placement":
        return role === "recruiter"
          ? `/recruiter/earnings`
          : `/dashboard/placements`;
      case "payout":
        return `/recruiter/payouts`;
      default:
        return null;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Gerade eben";
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return date.toLocaleDateString("de-DE");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="font-semibold">Benachrichtigungen</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Alle gelesen
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Keine Benachrichtigungen
            </div>
          ) : (
            notifications.slice(0, 10).map((notification) => {
              const link = getNotificationLink(notification);
              const content = (
                <div
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer transition-colors",
                    !notification.is_read && "bg-muted/50"
                  )}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notification.title}</p>
                    {notification.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                </div>
              );

              return (
                <DropdownMenuItem key={notification.id} asChild className="p-0 focus:bg-transparent">
                  {link ? (
                    <Link to={link} className="block w-full">
                      {content}
                    </Link>
                  ) : (
                    <div>{content}</div>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-center justify-center text-sm text-muted-foreground">
              <Link to={role === "recruiter" ? "/recruiter/notifications" : "/dashboard/notifications"}>
                Alle anzeigen
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
