import { 
  Target, 
  Calendar, 
  Users, 
  FolderKanban, 
  MessageSquare,
  LucideIcon,
  CheckCircle2
} from 'lucide-react';

interface TaskCategory {
  category: string;
  items: string[];
}

interface TasksStructuredProps {
  tasks: TaskCategory[];
}

interface CategoryConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  colorClass: string;
}

const categoryConfig: Record<string, CategoryConfig> = {
  core: { 
    key: 'core', 
    label: 'Kernaufgaben', 
    icon: Target,
    colorClass: 'text-primary'
  },
  periodic: { 
    key: 'periodic', 
    label: 'Wiederkehrend', 
    icon: Calendar,
    colorClass: 'text-blue-600 dark:text-blue-400'
  },
  leadership: { 
    key: 'leadership', 
    label: 'Führung', 
    icon: Users,
    colorClass: 'text-purple-600 dark:text-purple-400'
  },
  project: { 
    key: 'project', 
    label: 'Projekte', 
    icon: FolderKanban,
    colorClass: 'text-orange-600 dark:text-orange-400'
  },
  communication: { 
    key: 'communication', 
    label: 'Kommunikation', 
    icon: MessageSquare,
    colorClass: 'text-teal-600 dark:text-teal-400'
  },
};

export function TasksStructured({ tasks }: TasksStructuredProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Keine strukturierten Aufgaben verfügbar
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((taskGroup, groupIndex) => {
        const config = categoryConfig[taskGroup.category] || {
          label: taskGroup.category,
          icon: Target,
          colorClass: 'text-foreground'
        };
        const Icon = config.icon;

        return (
          <div key={groupIndex} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${config.colorClass}`} />
              <span className={`text-sm font-medium ${config.colorClass}`}>
                {config.label}
              </span>
            </div>
            <ul className="space-y-1.5 pl-6">
              {taskGroup.items.map((task, taskIndex) => (
                <li 
                  key={taskIndex} 
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Compact list version
export function TasksStructuredCompact({ tasks }: TasksStructuredProps) {
  if (!tasks || tasks.length === 0) return null;

  const allTasks = tasks.flatMap(group => group.items);
  const displayTasks = allTasks.slice(0, 5);

  return (
    <ul className="space-y-1">
      {displayTasks.map((task, index) => (
        <li 
          key={index} 
          className="flex items-start gap-2 text-sm text-foreground"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
          <span className="line-clamp-1">{task}</span>
        </li>
      ))}
      {allTasks.length > 5 && (
        <li className="text-xs text-muted-foreground pl-5">
          +{allTasks.length - 5} weitere Aufgaben
        </li>
      )}
    </ul>
  );
}
