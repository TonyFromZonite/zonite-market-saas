import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEmailVerification } from "@/components/useEmailVerification";

/**
 * Dialog that lets a seller request and validate the 6-digit verification
 * code for their email. Used from ProfilVendeur (manual trigger) and
 * EspaceVendeur lock screen.
 */
export default function EmailVerificationDialog({
  open,
  onOpenChange,
  seller,
  onVerified,
  autoSend = false,
}) {
  const { toast } = useToast();
  const { sendCode, verifyCode, sending, verifying } = useEmailVerification();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setCode("");
      setErreur("");
      setCodeSent(false);
      setCooldown(0);
      return;
    }
    if (autoSend && seller?.id && seller?.email && !codeSent) {
      handleSend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    setErreur("");
    const res = await sendCode({
      sellerId: seller.id,
      email: seller.email,
      nom: seller.full_name,
    });
    if (res.ok) {
      setCodeSent(true);
      setCooldown(30);
      toast({ title: "📨 Code envoyé", description: `Vérifiez votre boîte ${seller.email}` });
    } else {
      setErreur(res.error || "Envoi impossible");
    }
  };

  const handleVerify = async () => {
    setErreur("");
    const res = await verifyCode({ sellerId: seller.id, code });
    if (res.ok) {
      toast({
        title: "✅ Email vérifié",
        description: res.alreadyVerified ? "Cet email était déjà vérifié." : "Votre email est maintenant confirmé.",
      });
      onVerified?.();
      onOpenChange?.(false);
    } else {
      setErreur(res.error || "Code invalide");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-yellow-500" />
            Vérifier mon email
          </DialogTitle>
          <DialogDescription>
            Recevez un code à 6 chiffres sur <span className="font-semibold">{seller?.email}</span> pour confirmer votre adresse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!codeSent ? (
            <Button
              onClick={handleSend}
              disabled={sending || !seller?.email}
              className="w-full bg-[#1a1f5e] text-white hover:bg-[#1a1f5e]/90"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Envoyer le code
            </Button>
          ) : (
            <>
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
                <span>Code envoyé. Saisissez-le ci-dessous (valide 24h).</span>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-widest font-bold"
              />
              <Button
                onClick={handleVerify}
                disabled={verifying || code.length !== 6}
                className="w-full bg-[#1a1f5e] text-white hover:bg-[#1a1f5e]/90"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Valider le code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSend}
                disabled={sending || cooldown > 0}
                className="w-full text-xs"
              >
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer un nouveau code"}
              </Button>
            </>
          )}

          {erreur && <p className="text-sm text-red-600 text-center">{erreur}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
