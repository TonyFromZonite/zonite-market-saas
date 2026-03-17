/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification Zonite Market</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Img src="https://jpopxydfttoseckcakqp.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Zonite Market" width="80" height="80" style={logo} />
          <Heading style={brandTitle}>Zonite Market</Heading>
          <Text style={brandSubtitle}>Plateforme de vente</Text>
        </div>
        <div style={content}>
          <Heading style={h1}>Confirmez votre identité 🔒</Heading>
          <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
          <div style={codeBox}>
            <Text style={codeStyle}>{token}</Text>
          </div>
          <Text style={footer}>
            Ce code expirera sous peu. Si vous n'avez pas fait cette demande,
            vous pouvez ignorer cet email.
          </Text>
          <hr style={divider} />
          <Text style={brand}>L'équipe Zonite Market</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto' }
const header = {
  background: 'linear-gradient(135deg, #1a1f5e, #2d34a5)',
  padding: '30px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
}
const brandTitle = { color: '#F5C518', margin: '0', fontSize: '28px', fontWeight: 'bold' as const }
const brandSubtitle = { color: '#CBD5E1', marginTop: '5px', marginBottom: '0', fontSize: '14px' }
const content = { background: '#ffffff', padding: '30px', border: '1px solid #E2E8F0', borderRadius: '0 0 12px 12px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1E293B', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#64748B', lineHeight: '1.5', margin: '0 0 25px' }
const codeBox = { background: '#F1F5F9', borderRadius: '12px', padding: '20px', textAlign: 'center' as const, margin: '0 0 25px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '36px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#1a1f5e',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
const divider = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '20px 0' }
const brand = { fontSize: '12px', color: '#94A3B8', textAlign: 'center' as const, margin: '0' }
const logo = { margin: '0 auto 15px', borderRadius: '12px' }
