/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez le changement d'email pour Zonite Market</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Img src="https://jpopxydfttoseckcakqp.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Zonite Market" width="80" height="80" style={logo} />
          <Heading style={brandTitle}>Zonite Market</Heading>
          <Text style={brandSubtitle}>Plateforme de vente</Text>
        </div>
        <div style={content}>
          <Heading style={h1}>Changement d'adresse email ✉️</Heading>
          <Text style={text}>
            Vous avez demandé à changer votre adresse email de{' '}
            <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
            vers{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>
            Cliquez sur le bouton ci-dessous pour confirmer ce changement :
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirmer le changement
          </Button>
          <Text style={footer}>
            Si vous n'avez pas demandé ce changement, veuillez sécuriser votre
            compte immédiatement.
          </Text>
          <hr style={divider} />
          <Text style={brand}>L'équipe Zonite Market</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
const link = { color: '#1a1f5e', textDecoration: 'underline' }
const button = {
  backgroundColor: '#1a1f5e',
  color: '#F5C518',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94A3B8', margin: '30px 0 0' }
const divider = { border: 'none', borderTop: '1px solid #E2E8F0', margin: '20px 0' }
const brand = { fontSize: '12px', color: '#94A3B8', textAlign: 'center' as const, margin: '0' }
