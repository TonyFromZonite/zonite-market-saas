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
          module_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          module_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          module_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      candidatures_vendeur: {
        Row: {
          created_at: string
          id: string
          notes_admin: string | null
          seller_id: string | null
          statut: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes_admin?: string | null
          seller_id?: string | null
          statut?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes_admin?: string | null
          seller_id?: string | null
          statut?: string | null
          updated_at?: string
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
          active: boolean | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          nom: string
          ordre: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          nom: string
          ordre?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          nom?: string
          ordre?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      commandes_vendeur: {
        Row: {
          client_adresse: string | null
          client_nom: string | null
          client_telephone: string | null
          commission: number | null
          coursier_id: string | null
          created_at: string
          date_livraison: string | null
          id: string
          notes: string | null
          produits: Json | null
          statut: string | null
          total: number | null
          updated_at: string
          vendeur_id: string | null
          zone_livraison: string | null
        }
        Insert: {
          client_adresse?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commission?: number | null
          coursier_id?: string | null
          created_at?: string
          date_livraison?: string | null
          id?: string
          notes?: string | null
          produits?: Json | null
          statut?: string | null
          total?: number | null
          updated_at?: string
          vendeur_id?: string | null
          zone_livraison?: string | null
        }
        Update: {
          client_adresse?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          commission?: number | null
          coursier_id?: string | null
          created_at?: string
          date_livraison?: string | null
          id?: string
          notes?: string | null
          produits?: Json | null
          statut?: string | null
          total?: number | null
          updated_at?: string
          vendeur_id?: string | null
          zone_livraison?: string | null
        }
        Relationships: [
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
          created_at: string
          description: string | null
          id: string
          updated_at: string
          valeur: string | null
        }
        Insert: {
          cle: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur?: string | null
        }
        Update: {
          cle?: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur?: string | null
        }
        Relationships: []
      }
      coursiers: {
        Row: {
          actif: boolean | null
          created_at: string
          id: string
          nom: string
          telephone: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom: string
          telephone?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          id?: string
          nom?: string
          telephone?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coursiers_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_paiement_vendeur: {
        Row: {
          created_at: string
          date_traitement: string | null
          id: string
          mode_paiement: string | null
          montant: number
          notes: string | null
          numero_paiement: string | null
          statut: string | null
          traite_par: string | null
          updated_at: string
          vendeur_id: string | null
        }
        Insert: {
          created_at?: string
          date_traitement?: string | null
          id?: string
          mode_paiement?: string | null
          montant: number
          notes?: string | null
          numero_paiement?: string | null
          statut?: string | null
          traite_par?: string | null
          updated_at?: string
          vendeur_id?: string | null
        }
        Update: {
          created_at?: string
          date_traitement?: string | null
          id?: string
          mode_paiement?: string | null
          montant?: number
          notes?: string | null
          numero_paiement?: string | null
          statut?: string | null
          traite_par?: string | null
          updated_at?: string
          vendeur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_paiement_vendeur_traite_par_fkey"
            columns: ["traite_par"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
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
          updated_at: string
        }
        Insert: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string
          id?: string
          ordre?: number | null
          question: string
          reponse: string
          updated_at?: string
        }
        Update: {
          actif?: boolean | null
          categorie?: string | null
          created_at?: string
          id?: string
          ordre?: number | null
          question?: string
          reponse?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_audit: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entite: string | null
          entite_id: string | null
          id: string
          ip_address: string | null
          utilisateur_email: string | null
          utilisateur_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entite?: string | null
          entite_id?: string | null
          id?: string
          ip_address?: string | null
          utilisateur_email?: string | null
          utilisateur_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entite?: string | null
          entite_id?: string | null
          id?: string
          ip_address?: string | null
          utilisateur_email?: string | null
          utilisateur_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_audit_utilisateur_id_fkey"
            columns: ["utilisateur_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      livraisons: {
        Row: {
          adresse_livraison: string | null
          commande_id: string | null
          commande_type: string | null
          coursier_nom: string | null
          coursier_telephone: string | null
          created_at: string
          date_livraison: string | null
          date_prevue: string | null
          frais: number | null
          id: string
          notes: string | null
          statut: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          adresse_livraison?: string | null
          commande_id?: string | null
          commande_type?: string | null
          coursier_nom?: string | null
          coursier_telephone?: string | null
          created_at?: string
          date_livraison?: string | null
          date_prevue?: string | null
          frais?: number | null
          id?: string
          notes?: string | null
          statut?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          adresse_livraison?: string | null
          commande_id?: string | null
          commande_type?: string | null
          coursier_nom?: string | null
          coursier_telephone?: string | null
          created_at?: string
          date_livraison?: string | null
          date_prevue?: string | null
          frais?: number | null
          id?: string
          notes?: string | null
          statut?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "livraisons_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      mouvements_stock: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          motif: string | null
          produit_id: string | null
          quantite: number
          reference_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          motif?: string | null
          produit_id?: string | null
          quantite: number
          reference_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          motif?: string | null
          produit_id?: string | null
          quantite?: number
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mouvements_stock_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mouvements_stock_produit_id_fkey"
            columns: ["produit_id"]
            isOneToOne: false
            referencedRelation: "produits"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_vendeur: {
        Row: {
          created_at: string
          id: string
          lien: string | null
          lu: boolean | null
          message: string
          titre: string
          type: string | null
          vendeur_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean | null
          message: string
          titre: string
          type?: string | null
          vendeur_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lien?: string | null
          lu?: boolean | null
          message?: string
          titre?: string
          type?: string | null
          vendeur_id?: string | null
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
          id: string
          montant: number
          notes: string | null
          periode: string | null
          statut: string | null
          vendeur_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          montant: number
          notes?: string | null
          periode?: string | null
          statut?: string | null
          vendeur_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          montant?: number
          notes?: string | null
          periode?: string | null
          statut?: string | null
          vendeur_id?: string | null
        }
        Relationships: [
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
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          nom: string
          poids: number | null
          prix: number
          prix_achat: number | null
          seller_id: string | null
          sku: string | null
          stock: number
          stock_minimum: number | null
          unite: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          nom: string
          poids?: number | null
          prix?: number
          prix_achat?: number | null
          seller_id?: string | null
          sku?: string | null
          stock?: number
          stock_minimum?: number | null
          unite?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          nom?: string
          poids?: number | null
          prix?: number
          prix_achat?: number | null
          seller_id?: string | null
          sku?: string | null
          stock?: number
          stock_minimum?: number | null
          unite?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produits_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      retours_produit: {
        Row: {
          commande_id: string | null
          created_at: string
          id: string
          motif: string | null
          notes: string | null
          produit_id: string | null
          quantite: number | null
          statut: string | null
          updated_at: string
          vendeur_id: string | null
        }
        Insert: {
          commande_id?: string | null
          created_at?: string
          id?: string
          motif?: string | null
          notes?: string | null
          produit_id?: string | null
          quantite?: number | null
          statut?: string | null
          updated_at?: string
          vendeur_id?: string | null
        }
        Update: {
          commande_id?: string | null
          created_at?: string
          id?: string
          motif?: string | null
          notes?: string | null
          produit_id?: string | null
          quantite?: number | null
          statut?: string | null
          updated_at?: string
          vendeur_id?: string | null
        }
        Relationships: [
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
          created_at: string
          email: string
          experience_vente: string | null
          id: string
          nom_complet: string
          nombre_commandes: number | null
          numero_mobile_money: string | null
          operateur_mobile_money: string | null
          password_hash: string | null
          photo_identite_url: string | null
          photo_identite_verso_url: string | null
          quartier: string | null
          role: string
          selfie_url: string | null
          seller_status: string
          solde_commission: number | null
          statut_kyc: string | null
          telephone: string | null
          total_ventes: number | null
          training_completed: boolean | null
          updated_at: string
          user_id: string | null
          verification_code: string | null
          verification_code_expires_at: string | null
          ville: string | null
        }
        Insert: {
          catalogue_debloque?: boolean | null
          created_at?: string
          email: string
          experience_vente?: string | null
          id?: string
          nom_complet: string
          nombre_commandes?: number | null
          numero_mobile_money?: string | null
          operateur_mobile_money?: string | null
          password_hash?: string | null
          photo_identite_url?: string | null
          photo_identite_verso_url?: string | null
          quartier?: string | null
          role?: string
          selfie_url?: string | null
          seller_status?: string
          solde_commission?: number | null
          statut_kyc?: string | null
          telephone?: string | null
          total_ventes?: number | null
          training_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
          verification_code?: string | null
          verification_code_expires_at?: string | null
          ville?: string | null
        }
        Update: {
          catalogue_debloque?: boolean | null
          created_at?: string
          email?: string
          experience_vente?: string | null
          id?: string
          nom_complet?: string
          nombre_commandes?: number | null
          numero_mobile_money?: string | null
          operateur_mobile_money?: string | null
          password_hash?: string | null
          photo_identite_url?: string | null
          photo_identite_verso_url?: string | null
          quartier?: string | null
          role?: string
          selfie_url?: string | null
          seller_status?: string
          solde_commission?: number | null
          statut_kyc?: string | null
          telephone?: string | null
          total_ventes?: number | null
          training_completed?: boolean | null
          updated_at?: string
          user_id?: string | null
          verification_code?: string | null
          verification_code_expires_at?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      sous_admins: {
        Row: {
          actif: boolean | null
          created_at: string
          email: string | null
          id: string
          nom_complet: string | null
          permissions: string[] | null
          seller_id: string | null
          updated_at: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nom_complet?: string | null
          permissions?: string[] | null
          seller_id?: string | null
          updated_at?: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          nom_complet?: string | null
          permissions?: string[] | null
          seller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sous_admins_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets_support: {
        Row: {
          created_at: string
          id: string
          lu: boolean | null
          message: string
          priorite: string | null
          reponse: string | null
          statut: string | null
          sujet: string
          updated_at: string
          vendeur_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message: string
          priorite?: string | null
          reponse?: string | null
          statut?: string | null
          sujet: string
          updated_at?: string
          vendeur_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lu?: boolean | null
          message?: string
          priorite?: string | null
          reponse?: string | null
          statut?: string | null
          sujet?: string
          updated_at?: string
          vendeur_id?: string | null
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
      ventes: {
        Row: {
          client_adresse: string | null
          client_nom: string | null
          client_telephone: string | null
          coursier_id: string | null
          created_at: string
          id: string
          mode_paiement: string | null
          notes: string | null
          produits: Json | null
          statut: string | null
          total: number | null
          updated_at: string
          zone_livraison: string | null
        }
        Insert: {
          client_adresse?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          coursier_id?: string | null
          created_at?: string
          id?: string
          mode_paiement?: string | null
          notes?: string | null
          produits?: Json | null
          statut?: string | null
          total?: number | null
          updated_at?: string
          zone_livraison?: string | null
        }
        Update: {
          client_adresse?: string | null
          client_nom?: string | null
          client_telephone?: string | null
          coursier_id?: string | null
          created_at?: string
          id?: string
          mode_paiement?: string | null
          notes?: string | null
          produits?: Json | null
          statut?: string | null
          total?: number | null
          updated_at?: string
          zone_livraison?: string | null
        }
        Relationships: []
      }
      zones: {
        Row: {
          actif: boolean | null
          created_at: string
          description: string | null
          frais_livraison: number | null
          id: string
          nom: string
          updated_at: string
        }
        Insert: {
          actif?: boolean | null
          created_at?: string
          description?: string | null
          frais_livraison?: number | null
          id?: string
          nom: string
          updated_at?: string
        }
        Update: {
          actif?: boolean | null
          created_at?: string
          description?: string | null
          frais_livraison?: number | null
          id?: string
          nom?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_seller_role: { Args: { _user_id: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
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
