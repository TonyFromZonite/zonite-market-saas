// Ré-export unique vers le store toast canonique (@/hooks/use-toast).
// Avant : ce fichier avait sa propre implémentation, ce qui créait DEUX stores
// indépendants (toasts émis ici invisibles depuis l'autre import). Fix bug : on
// pointe désormais tout le monde vers la même source.
export { useToast, toast } from "@/hooks/use-toast";
