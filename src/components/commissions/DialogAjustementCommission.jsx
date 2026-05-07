import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

export default function DialogAjustementCommission({ vendeur, onClose, onSuccess, toast }) {
  const [type, setType] = useState("credit");
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (vendeur) { setType("credit"); setMontant(""); setMotif(""); }
  }, [vendeur]);

  if (!vendeur) return null;

  const montantNum = Number(montant) || 0;
  const delta = type === "credit" ? montantNum : -montantNum;
  const soldeActuel = Number(vendeur.solde_commission || 0);
  const soldeApres = Math.max(0, soldeActuel + delta);

  const handleSubmit = async () => {
    if (montantNum <= 0) { toast?.({ title: "Montant invalide", description: "Saisissez un montant > 0", variant: "destructive" }); return; }
    if (motif.trim().length < 5) { toast?.({ title: "Motif requis", description: "Minimum 5 caractères", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("admin_adjust_seller_commission", {
        _seller_id: vendeur.id,
        _delta: delta,
        _motif: motif.trim(),
        _admin_email: user?.email || "admin",
      });
      if (error) throw error;
      toast?.({ title: "Ajustement effectué", description: `Solde ajusté de ${delta >= 0 ? "+" : "−"}${formater(Math.abs(delta))}.` });
      onSuccess?.({ delta, sellerId: vendeur.id });
      onClose();
    } catch (e) {
      toast?.({ title: "Erreur", description: e.message || "Impossible d'ajuster le solde", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!vendeur} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuster le solde commission</DialogTitle>
          <DialogDescription>{vendeur.full_name || vendeur.nom_complet} — Solde actuel : <strong>{formater(soldeActuel)}</strong></DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Type d'ajustement</Label>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant={type === "credit" ? "default" : "outline"} className="flex-1" onClick={() => setType("credit")}>
                <Plus className="w-4 h-4 mr-1" /> Créditer
              </Button>
              <Button type="button" variant={type === "debit" ? "default" : "outline"} className="flex-1" onClick={() => setType("debit")}>
                <Minus className="w-4 h-4 mr-1" /> Débiter
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="ajust-montant">Montant (FCFA)</Label>
            <Input id="ajust-montant" type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label htmlFor="ajust-motif">Motif (visible par le vendeur)</Label>
            <Textarea id="ajust-motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : Bonus exceptionnel, correction d'erreur, ..." rows={3} />
          </div>
          {montantNum > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              Nouveau solde : <strong className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>{formater(soldeApres)}</strong>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Traitement..." : "Confirmer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
