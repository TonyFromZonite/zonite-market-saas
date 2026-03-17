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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre email pour Zonite Market</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={header}>
          <Img src="https://jpopxydfttoseckcakqp.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="Zonite Market" width="80" height="80" style={logo} />
          <Heading style={brandTitle}>Zonite Market</Heading>
          <Text style={brandSubtitle}>Plateforme de vente</Text>
        </div>
        <div style={content}>
          <Heading style={h1}>Confirmez votre email 👋</Heading>
          <Text style={text}>
            Merci de vous être inscrit sur{' '}
            <Link href={siteUrl} style={link}>
              <strong>Zonite Market</strong>
            </Link>
            !
          </Text>
          <Text style={text}>
            Veuillez confirmer votre adresse email (
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            ) en cliquant sur le bouton ci-dessous :
          </Text>
          <Button style={button} href={confirmationUrl}>
            Vérifier mon email
          </Button>
          <Text style={footer}>
            Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
          </Text>
          <hr style={divider} />
          <Text style={brand}>L'équipe Zonite Market</Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
