export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          created_at: string
          id: string
          modules_autorises: Json | null
          sous_admin_email: string
          sous_admin_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          modules_autorises?: Json | null
          sous_admin_email: string
          sous_admin_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          modules_autorises?: Json | null
          sous_admin_email?: string
          sous_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_sous_admin_id_fkey"
            columns: ["sous_admin_id"]
            isOneToOne: false
            referencedRelation: "sous_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatures_vendeur: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          notes_admin: string | null
          seller_id: string | null
          statut: string | null
          telephone: string | null
          ville: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          notes_admin?: string | null
          seller_id?: string | null
          statut?: string | null
          telephone?: string | null
          ville?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notes_admin?: string | null
          seller_id?: string | null
          statut?: string | null
          telephone?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidatures_vendeur_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          actif: boolean | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          nom: string
          ordre: number | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          nom: string
          ordre?: number | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          nom?: string
          ordre?: number | null
        }
        Relationships: []
      }
      commandes_vendeur: {
        Row: {
          client_adresse: string | null
          client_nom: string
          client_quartier: string | null
          client_telephone: string
          client_ville: string | null
          coursier_id: string | null
          coursier_nom: string | null
          created_at: string
          date_livraison_effective: string | null
          date_livraison_estimee: string | null
          date_livraison_prevue: string | null
          frais_livraison: number | null
          id: string
          livraison_incluse: boolean | null
          livreur_id: string | null
          montant_total: number
          notes: string | null
          notes_admin: string | null
          prix_final_client: number | null
          prix_unitaire: number
          produit_id: string | null
          produit_nom: string
          produit_reference: string | null
          quantite: number | null
          reference_commande: string | null
          statut: string | null
          updated_at: string
          variation: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Insert: {
          client_adresse?: string | null
          client_nom: string
          client_quartier?: string | null
          client_telephone: string
          client_ville?: string | null
          coursier_id?: string | null
          coursier_nom?: string | null
          created_at?: string
          date_livraison_effective?: string | null
          date_livraison_estimee?: string | null
          date_livraison_prevue?: string | null
          frais_livraison?: number | null
          id?: string
          livraison_incluse?: boolean | null
          livreur_id?: string | null
          montant_total?: number
          notes?: string | null
          notes_admin?: string | null
          prix_final_client?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          produit_nom: string
          produit_reference?: string | null
          quantite?: number | null
          reference_commande?: string | null
          statut?: string | null
          updated_at?: string
          variation?: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Update: {
          client_adresse?: string | null
          client_nom?: string
          client_quartier?: string | null
          client_telephone?: string
          client_ville?: string | null
          coursier_id?: string | null
          coursier_nom?: string | null
          created_at?: string
          date_livraison_effective?: string | null
          date_livraison_estimee?: string | null
          date_livraison_prevue?: string | null
          frais_livraison?: number | null
          id?: string
          livraison_incluse?: boolean | null
          livreur_id?: string | null
          montant_total?: number
          notes?: string | null
          notes_admin?: string | null
          prix_final_client?: number | null
          prix_unitaire?: number
          produit_id?: string | null
          produit_nom?: string
          produit_reference?: string | null
          quantite?: number | null
          reference_commande?: string | null
          statut?: string | null
          updated_at?: string
          variation?: string | null
          vendeur_email?: string
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_vendeur_coursier_id_fkey"
            columns: ["coursier_id"]
            isOneToOne: false
            referencedRelation: "coursiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_vendeur_livreur_id_fkey"
            columns: ["livreur_id"]
            isOneToOne: false
            referencedRelation: "livraisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_vendeur_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_vendeur_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      config_app: {
        Row: {
          cle: string
          description: string | null
          id: string
          updated_at: string
          valeur: Json
        }
        Insert: {
          cle: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur?: Json
        }
        Update: {
          cle?: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur?: Json
        }
        Relationships: []
      }
      coursiers: {
        Row: {
          actif: boolean | null
          adresse_entrepot: string | null
          created_at: string
          email: string | null
          frais_livraison_defaut: number | null
          id: string
          nom: string
          telephone: string | null
          ville_id: string | null
          zones_livraison_ids: Json | null
        }
        Insert: {
          actif?: boolean | null
          adresse_entrepot?: string | null
          created_at?: string
          email?: string | null
          frais_livraison_defaut?: number | null
          id?: string
          nom: string
          telephone?: string | null
          ville_id?: string | null
          zones_livraison_ids?: Json | null
        }
        Update: {
          actif?: boolean | null
          adresse_entrepot?: string | null
          created_at?: string
          email?: string | null
          frais_livraison_defaut?: number | null
          id?: string
          nom?: string
          telephone?: string | null
          ville_id?: string | null
          zones_livraison_ids?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "coursiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_cameroun"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_paiement_vendeur: {
        Row: {
          created_at: string
          id: string
          montant: number
          notes: string | null
          notes_admin: string | null
          numero_mobile_money: string
          operateur_mobile_money: string
          reference_paiement: string | null
          statut: string | null
          traite_at: string | null
          traite_par: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          montant: number
          notes?: string | null
          notes_admin?: string | null
          numero_mobile_money: string
          operateur_mobile_money: string
          reference_paiement?: string | null
          statut?: string | null
          traite_at?: string | null
          traite_par?: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Update: {
          created_at?: string
          id?: string
          montant?: number
          notes?: string | null
          notes_admin?: string | null
          numero_mobile_money?: string
          operateur_mobile_money?: string
          reference_paiement?: string | null
          statut?: string | null
          traite_at?: string | null
          traite_par?: string | null
          vendeur_email?: string
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demandes_paiement_vendeur_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          actif: boolean | null
          categorie: string | null
          created_at: string
          id: string
          ordre: number | null
          question: string
          reponse: string
        }
        Insert: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string
          id?: string
          ordre?: number | null
          question: string
          reponse: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string
          id?: string
          ordre?: number | null
          question?: string
          reponse?: string
        }
        Relationships: []
      }
      journal_audit: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          donnees_apres: Json | null
          donnees_avant: Json | null
          entite_id: string | null
          entite_type: string | null
          id: string
          ip_address: string | null
          module: string
          utilisateur: string | null
          utilisateur_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          donnees_apres?: Json | null
          donnees_avant?: Json | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          utilisateur?: string | null
          utilisateur_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          donnees_apres?: Json | null
          donnees_avant?: Json | null
          entite_id?: string | null
          entite_type?: string | null
          id?: string
          ip_address?: string | null
          module?: string
          utilisateur?: string | null
          utilisateur_id?: string | null
        }
        Relationships: []
      }
      livraisons: {
        Row: {
          actif: boolean | null
          created_at: string
          email: string | null
          id: string
          nom: string
          tarif_par_zone: Json | null
          telephone: string | null
          zones_couvertes: Json | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          tarif_par_zone?: Json | null
          telephone?: string | null
          zones_couvertes?: Json | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          tarif_par_zone?: Json | null
          telephone?: string | null
          zones_couvertes?: Json | null
        }
        Relationships: []
      }
      mouvements_stock: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          localisation: string | null
          notes: string | null
          produit_id: string
          quantite: number
          reference_id: string | null
          stock_apres: number | null
          stock_avant: number | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          localisation?: string | null
          notes?: string | null
          produit_id: string
          quantite: number
          reference_id?: string | null
          stock_apres?: number | null
          stock_avant?: number | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          localisation?: string | null
          notes?: string | null
          produit_id?: string
          quantite?: number
          reference_id?: string | null
          stock_apres?: number | null
          stock_avant?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_admin: {
        Row: {
          created_at: string
          id: string
          lu: boolean | null
          message: string
          reference_id: string | null
          titre: string
          type: string | null
          vendeur_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message: string
          reference_id?: string | null
          titre: string
          type?: string | null
          vendeur_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message?: string
          reference_id?: string | null
          titre?: string
          type?: string | null
          vendeur_email?: string | null
        }
        Relationships: []
      }
      notifications_vendeur: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          lu: boolean | null
          message: string
          titre: string
          type: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          lu?: boolean | null
          message: string
          titre: string
          type?: string | null
          vendeur_email: string
          vendeur_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          lu?: boolean | null
          message?: string
          titre?: string
          type?: string | null
          vendeur_email?: string
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_vendeur_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      paiements_commission: {
        Row: {
          created_at: string
          demande_id: string | null
          effectue_par: string | null
          id: string
          methode_paiement: string | null
          montant: number
          reference_paiement: string | null
          vendeur_id: string
        }
        Insert: {
          created_at?: string
          demande_id?: string | null
          effectue_par?: string | null
          id?: string
          methode_paiement?: string | null
          montant: number
          reference_paiement?: string | null
          vendeur_id: string
        }
        Update: {
          created_at?: string
          demande_id?: string | null
          effectue_par?: string | null
          id?: string
          methode_paiement?: string | null
          montant?: number
          reference_paiement?: string | null
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paiements_commission_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes_paiement_vendeur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paiements_commission_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      produits: {
        Row: {
          actif: boolean | null
          categorie_id: string | null
          created_at: string
          description: string | null
          details: string | null
          featured: boolean | null
          fournisseur: string | null
          id: string
          images: Json | null
          lien_telegram: string | null
          nom: string
          prix_achat: number | null
          prix_gros: number | null
          prix_vente: number
          reference: string | null
          seuil_alerte_stock: number | null
          stock_global: number | null
          stocks_par_coursier: Json | null
          stocks_par_localisation: Json | null
          updated_at: string
          variations: Json | null
        }
        Insert: {
          actif?: boolean | null
          categorie_id?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          featured?: boolean | null
          fournisseur?: string | null
          id?: string
          images?: Json | null
          lien_telegram?: string | null
          nom: string
          prix_achat?: number | null
          prix_gros?: number | null
          prix_vente?: number
          reference?: string | null
          seuil_alerte_stock?: number | null
          stock_global?: number | null
          stocks_par_coursier?: Json | null
          stocks_par_localisation?: Json | null
          updated_at?: string
          variations?: Json | null
        }
        Update: {
          actif?: boolean | null
          categorie_id?: string | null
          created_at?: string
          description?: string | null
          details?: string | null
          featured?: boolean | null
          fournisseur?: string | null
          id?: string
          images?: Json | null
          lien_telegram?: string | null
          nom?: string
          prix_achat?: number | null
          prix_gros?: number | null
          prix_vente?: number
          reference?: string | null
          seuil_alerte_stock?: number | null
          stock_global?: number | null
          stocks_par_coursier?: Json | null
          stocks_par_localisation?: Json | null
          updated_at?: string
          variations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "produits_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      quartiers: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          ville_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          ville_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          ville_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quartiers_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_cameroun"
            referencedColumns: ["id"]
          },
        ]
      }
      retours_produit: {
        Row: {
          commande_id: string | null
          created_at: string
          id: string
          impact_commission: number | null
          notes_admin: string | null
          produit_id: string
          quantite: number
          raison: string | null
          statut: string | null
          vendeur_id: string
        }
        Insert: {
          commande_id?: string | null
          created_at?: string
          id?: string
          impact_commission?: number | null
          notes_admin?: string | null
          produit_id: string
          quantite?: number
          raison?: string | null
          statut?: string | null
          vendeur_id: string
        }
        Update: {
          commande_id?: string | null
          created_at?: string
          id?: string
          impact_commission?: number | null
          notes_admin?: string | null
          produit_id?: string
          quantite?: number
          raison?: string | null
          statut?: string | null
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retours_produit_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes_vendeur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retours_produit_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retours_produit_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          catalogue_debloque: boolean | null
          conditions_acceptees: boolean | null
          created_at: string
          date_naissance: string | null
          email: string
          email_verification_code: string | null
          email_verification_expires_at: string | null
          email_verified: boolean | null
          experience_vente: string | null
          full_name: string
          id: string
          kyc_document_recto_url: string | null
          kyc_document_verso_url: string | null
          kyc_raison_rejet: string | null
          kyc_selfie_url: string | null
          kyc_type_document: string | null
          motivation: string | null
          numero_mobile_money: string | null
          operateur_mobile_money: string | null
          photo_profil_url: string | null
          quartier: string | null
          role: string
          seller_status: string
          solde_commission: number | null
          statut_kyc: string | null
          taux_commission: number | null
          telephone: string | null
          total_commissions_gagnees: number | null
          total_commissions_payees: number | null
          training_completed: boolean | null
          updated_at: string
          user_id: string | null
          username: string | null
          ville: string | null
          whatsapp: string | null
        }
        Insert: {
          catalogue_debloque?: boolean | null
          conditions_acceptees?: boolean | null
          created_at?: string
          date_naissance?: string | null
          email: string
          email_verification_code?: string | null
          email_verification_expires_at?: string | null
          email_verified?: boolean | null
          experience_vente?: string | null
          full_name: string
          id?: string
          kyc_document_recto_url?: string | null
          kyc_document_verso_url?: string | null
          kyc_raison_rejet?: string | null
          kyc_selfie_url?: string | null
          kyc_type_document?: string | null
          motivation?: string | null
          numero_mobile_money?: string | null
          operateur_mobile_money?: string | null
          photo_profil_url?: string | null
          quartier?: string | null
          role?: string
          seller_status?: string
          solde_commission?: number | null
          statut_kyc?: string | null
          taux_commission?: number | null
          telephone?: string | null
          total_commissions_gagnees?: number | null
          total_commissions_payees?: number | null
          training_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Update: {
          catalogue_debloque?: boolean | null
          conditions_acceptees?: boolean | null
          created_at?: string
          date_naissance?: string | null
          email?: string
          email_verification_code?: string | null
          email_verification_expires_at?: string | null
          email_verified?: boolean | null
          experience_vente?: string | null
          full_name?: string
          id?: string
          kyc_document_recto_url?: string | null
          kyc_document_verso_url?: string | null
          kyc_raison_rejet?: string | null
          kyc_selfie_url?: string | null
          kyc_type_document?: string | null
          motivation?: string | null
          numero_mobile_money?: string | null
          operateur_mobile_money?: string | null
          photo_profil_url?: string | null
          quartier?: string | null
          role?: string
          seller_status?: string
          solde_commission?: number | null
          statut_kyc?: string | null
          taux_commission?: number | null
          telephone?: string | null
          total_commissions_gagnees?: number | null
          total_commissions_payees?: number | null
          training_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      sous_admins: {
        Row: {
          actif: boolean | null
          created_at: string
          email: string
          full_name: string
          id: string
          nom_role: string | null
          seller_id: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          nom_role?: string | null
          seller_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nom_role?: string | null
          seller_id?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_admins_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      statistiques_journalieres: {
        Row: {
          chiffre_affaires: number | null
          commandes_annulees: number | null
          commandes_livrees: number | null
          created_at: string
          date: string
          id: string
          nouveaux_vendeurs: number | null
          profit_zonite: number | null
          total_commandes: number | null
          total_commissions: number | null
          vendeurs_actifs: number | null
        }
        Insert: {
          chiffre_affaires?: number | null
          commandes_annulees?: number | null
          commandes_livrees?: number | null
          created_at?: string
          date: string
          id?: string
          nouveaux_vendeurs?: number | null
          profit_zonite?: number | null
          total_commandes?: number | null
          total_commissions?: number | null
          vendeurs_actifs?: number | null
        }
        Update: {
          chiffre_affaires?: number | null
          commandes_annulees?: number | null
          commandes_livrees?: number | null
          created_at?: string
          date?: string
          id?: string
          nouveaux_vendeurs?: number | null
          profit_zonite?: number | null
          total_commandes?: number | null
          total_commissions?: number | null
          vendeurs_actifs?: number | null
        }
        Relationships: []
      }
      tickets_support: {
        Row: {
          categorie: string | null
          created_at: string
          id: string
          lu_par_vendeur: boolean | null
          message: string
          priorite: string | null
          repondu_at: string | null
          repondu_par: string | null
          reponse_admin: string | null
          statut: string | null
          sujet: string
          vendeur_email: string
          vendeur_id: string
        }
        Insert: {
          categorie?: string | null
          created_at?: string
          id?: string
          lu_par_vendeur?: boolean | null
          message: string
          priorite?: string | null
          repondu_at?: string | null
          repondu_par?: string | null
          reponse_admin?: string | null
          statut?: string | null
          sujet: string
          vendeur_email: string
          vendeur_id: string
        }
        Update: {
          categorie?: string | null
          created_at?: string
          id?: string
          lu_par_vendeur?: boolean | null
          message?: string
          priorite?: string | null
          repondu_at?: string | null
          repondu_par?: string | null
          reponse_admin?: string | null
          statut?: string | null
          sujet?: string
          vendeur_email?: string
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_support_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ventes: {
        Row: {
          annee: number | null
          commande_id: string | null
          commission_vendeur: number
          created_at: string
          id: string
          mois: number | null
          montant_total: number
          prix_achat_unitaire: number | null
          produit_id: string
          profit_zonite: number
          quantite: number
          semaine: number | null
          taux_commission_applique: number | null
          vendeur_email: string
          vendeur_id: string
        }
        Insert: {
          annee?: number | null
          commande_id?: string | null
          commission_vendeur?: number
          created_at?: string
          id?: string
          mois?: number | null
          montant_total: number
          prix_achat_unitaire?: number | null
          produit_id: string
          profit_zonite?: number
          quantite: number
          semaine?: number | null
          taux_commission_applique?: number | null
          vendeur_email: string
          vendeur_id: string
        }
        Update: {
          annee?: number | null
          commande_id?: string | null
          commission_vendeur?: number
          created_at?: string
          id?: string
          mois?: number | null
          montant_total?: number
          prix_achat_unitaire?: number | null
          produit_id?: string
          profit_zonite?: number
          quantite?: number
          semaine?: number | null
          taux_commission_applique?: number | null
          vendeur_email?: string
          vendeur_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventes_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes_vendeur"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventes_vendeur_id_fkey"
            columns: ["vendeur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      villes_cameroun: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          region: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          region?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          region?: string | null
        }
        Relationships: []
      }
      zones: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          ville: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          ville?: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          ville?: string
        }
        Relationships: []
      }
      zones_livraison: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          quartiers_ids: Json | null
          ville_id: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          quartiers_ids?: Json | null
          ville_id: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          quartiers_ids?: Json | null
          ville_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_livraison_ville_id_fkey"
            columns: ["ville_id"]
            isOneToOne: false
            referencedRelation: "villes_cameroun"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_seller_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_seller_role: { Args: { _user_id: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_admin_or_sous_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
