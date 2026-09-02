import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg",
        // bg-background hiess: exakt die Seitenfarbe. Im dunklen Modus war der
        // Knopf dadurch nicht vom Hintergrund zu unterscheiden -- gemessen ein
        // Kontrastverhaeltnis von 1,00 -- und las sich als Text statt als
        // Bedienelement. Eine leicht angehobene Flaeche macht ihn sichtbar,
        // ohne ihn zu einem gefuellten Knopf zu machen.
        outline: "border border-input bg-secondary/60 hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Zwei Fehler, gemessen im dunklen Modus:
        //
        // (a) text-primary-foreground ist dort fast SCHWARZ (4 %) -- die
        //     Variante ueberschrieb nur den Hintergrund, nicht die Schrift.
        //     Schwarz auf Dunkelblau ergab einen Kontrast von 1,11: die
        //     Hauptaktion der Seite war nicht lesbar. Der Verlauf ist fest
        //     verdrahtet und damit themenunabhaengig -- also muss es die
        //     Schriftfarbe auch sein.
        //
        // (b) Der Verlauf lag bei 12-20 % Helligkeit auf 4-%-Grund, Kontrast
        //     1,38. Der Knopf hob sich nicht vom Hintergrund ab. Jetzt heller,
        //     damit die wichtigste Schaltflaeche auch als solche zu erkennen ist.
        hero: "bg-gradient-to-r from-[hsl(222,60%,42%)] to-[hsl(222,65%,32%)] text-white hover:from-[hsl(222,60%,48%)] hover:to-[hsl(222,65%,38%)] shadow-lg hover:shadow-xl transition-all duration-300",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-md hover:shadow-lg",
        emerald: "bg-[hsl(152,69%,40%)] text-white hover:bg-[hsl(152,69%,50%)] shadow-md hover:shadow-lg",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
