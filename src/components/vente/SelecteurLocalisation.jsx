import React, { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sélecteur dynamique basé sur stocks_par_coursier.
 * Cascade : Produit → Ville (du coursier) → Coursier → Variation
 */
export default function SelecteurLocalisation({ produit, value, onChange, disabled }) {
  const [villeId, setVilleId] = useState("");
  const [coursierId, setCoursierId] = useState("");
  const [variationKey, setVariationKey] = useState("");

  const { data: villes = [] } = useQuery({
    queryKey: ["villes_cameroun"],
    queryFn: async () => {
      const { data } = await supabase.from("villes_cameroun").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  const { data: coursiers = [] } = useQuery({
    queryKey: ["coursiers"],
    queryFn: async () => {
      const { data } = await supabase.from("coursiers").select("*").eq("actif", true).order("nom");
      return data || [];
    },
  });

  // Reset when product changes
  useEffect(() => {
    setVilleId("");
    setCoursierId("");
    setVariationKey("");
    onChange?.({ ville: "", zone: "", variation: "", stockDisponible: 0, coursierId: "", coursierNom: "" });
  }, [produit?.id]);

  // Get coursiers that have stock for this product in selected ville
  const coursiersDisponibles = useMemo(() => {
    if (!produit || !villeId) return [];
    const spc = produit.stocks_par_coursier || [];
    return coursiers.filter((c) => {
      if (c.ville_id !== villeId) return false;
      const entry = spc.find((s) => s.coursier_id === c.id);
      return entry && (entry.stock_total || 0) > 0;
    });
  }, [produit, villeId, coursiers]);

  // Get variation keys with stock for selected coursier
  const variationsDisponibles = useMemo(() => {
    if (!produit || !coursierId) return [];
    const spc = produit.stocks_par_coursier || [];
    const entry = spc.find((s) => s.coursier_id === coursierId);
    if (!entry) return [];
    return (entry.stock_par_variation || []).filter((v) => (v.quantite || 0) > 0);
  }, [produit, coursierId]);

  // Villes that have at least one coursier with stock
  const villesAvecStock = useMemo(() => {
    if (!produit) return [];
    const spc = produit.stocks_par_coursier || [];
    const coursierIdsAvecStock = spc.filter((s) => (s.stock_total || 0) > 0).map((s) => s.coursier_id);
    const villeIds = new Set(coursiers.filter((c) => coursierIdsAvecStock.includes(c.id)).map((c) => c.ville_id));
    return villes.filter((v) => villeIds.has(v.id));
  }, [produit, villes, coursiers]);

  const handleVilleChange = (v) => {
    setVilleId(v);
    setCoursierId("");
    setVariationKey("");
    onChange?.({ ville: villes.find((vi) => vi.id === v)?.nom || "", zone: "", variation: "", stockDisponible: 0, coursierId: "", coursierNom: "" });
  };

  const handleCoursierChange = (cId) => {
    setCoursierId(cId);
    setVariationKey("");
    const c = coursiers.find((co) => co.id === cId);
    onChange?.({ ville: villes.find((v) => v.id === villeId)?.nom || "", zone: c?.nom || "", variation: "", stockDisponible: 0, coursierId: cId, coursierNom: c?.nom || "" });
  };

  const handleVariationChange = (vk) => {
    setVariationKey(vk);
    const entry = (produit?.stocks_par_coursier || []).find((s) => s.coursier_id === coursierId);
    const sv = (entry?.stock_par_variation || []).find((v) => v.variation_key === vk);
    const stock = sv?.quantite || 0;
    const c = coursiers.find((co) => co.id === coursierId);
    const frais = c?.frais_livraison_defaut || 0;
    onChange?.({
      ville: villes.find((v) => v.id === villeId)?.nom || "",
      zone: c?.nom || "",
      variation: vk,
      stockDisponible: stock,
      prixLivraison: frais,
      coursierId,
      coursierNom: c?.nom || "",
    });
  };

  if (!produit) {
    return (
      <div className="bg-slate-50 rounded-lg p-4 text-center text-sm text-slate-500">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Sélectionnez d'abord un produit
      </div>
    );
  }

  const variations = produit.variations || [];
  const hasVariations = variations.length > 0;

  return (
    <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-4 h-4 text-slate-600" />
        <h3 className="font-semibold text-sm text-slate-900">Localisation & Stock</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {villesAvecStock.length} ville{villesAvecStock.length > 1 ? "s" : ""} disponible{villesAvecStock.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {villesAvecStock.length === 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ Aucun stock disponible pour ce produit.
        </div>
      ) : (
        <>
          {/* Ville */}
          <div className="space-y-2">
            <Label>Ville *</Label>
            <Select value={villeId} onValueChange={handleVilleChange} disabled={disabled}>
              <SelectTrigger><SelectValue placeholder="Choisir une ville" /></SelectTrigger>
              <SelectContent>
                {villesAvecStock.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Coursier */}
          {villeId && (
            <div className="space-y-2">
              <Label>Coursier / Entrepôt *</Label>
              {coursiersDisponibles.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  Aucun coursier avec stock dans cette ville.
                </div>
              ) : coursiersDisponibles.length === 1 ? (
                (() => {
                  const c = coursiersDisponibles[0];
                  if (!coursierId) handleCoursierChange(c.id);
                  const entry = (produit.stocks_par_coursier || []).find((s) => s.coursier_id === c.id);
                  return (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-emerald-600" />
                        <span className="font-medium text-emerald-800">{c.nom}</span>
                      </div>
                      <p className="text-xs text-emerald-600 mt-1">Stock: {entry?.stock_total || 0} | Frais: {(c.frais_livraison_defaut || 0).toLocaleString()} FCFA</p>
                    </div>
                  );
                })()
              ) : (
                <Select value={coursierId} onValueChange={handleCoursierChange} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {coursiersDisponibles.map((c) => {
                      const entry = (produit.stocks_par_coursier || []).find((s) => s.coursier_id === c.id);
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} — Stock: {entry?.stock_total || 0}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Variation */}
          {coursierId && hasVariations && (
            <div className="space-y-2">
              <Label>Variation *</Label>
              {variationsDisponibles.length === 0 ? (
                <p className="text-xs text-red-600">Aucune variation en stock chez ce coursier.</p>
              ) : (
                <Select value={variationKey} onValueChange={handleVariationChange} disabled={disabled}>
                  <SelectTrigger><SelectValue placeholder="Choisir une variation" /></SelectTrigger>
                  <SelectContent>
                    {variationsDisponibles.map((v) => (
                      <SelectItem key={v.variation_key} value={v.variation_key}>
                        {v.variation_key} — Stock: {v.quantite}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {variationKey && (
                <p className="text-xs text-emerald-600 font-medium">
                  ✓ Stock disponible: {variationsDisponibles.find((v) => v.variation_key === variationKey)?.quantite || 0} unités
                </p>
              )}
            </div>
          )}

          {/* No variations - show stock directly */}
          {coursierId && !hasVariations && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
              ✓ Stock disponible: {(produit.stocks_par_coursier || []).find((s) => s.coursier_id === coursierId)?.stock_total || 0} unités
            </div>
          )}
        </>
      )}
    </div>
  );
}
