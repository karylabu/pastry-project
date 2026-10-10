<?php

namespace App\Mail;

use App\Models\Promotion;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\URL;

class PromotionEmail extends Mailable
{
    use Queueable, SerializesModels;

    public Promotion $promotion;
    public User $recipient;

    public function __construct(Promotion $promotion, User $recipient)
    {
        $this->promotion = $promotion;
        $this->recipient = $recipient;
    }

    public function build()
    {
        $unsubscribeUrl = URL::signedRoute('promotions.unsubscribe', [
            'token' => Crypt::encryptString((string) $this->recipient->getKey()),
        ]);

        $this->withSymfonyMessage(function ($message) use ($unsubscribeUrl) {
            $message->getHeaders()->addTextHeader('List-Unsubscribe', '<' . $unsubscribeUrl . '>');
            $message->getHeaders()->addTextHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
        });

        return $this->subject($this->promotion->title)
            ->html($this->renderHtml($unsubscribeUrl));
    }

    protected function renderHtml(string $unsubscribeUrl): string
    {
        $couponHtml = '';
        if (! empty($this->promotion->coupon_code)) {
            $couponHtml = sprintf(
                '<p style="margin: 0 0 12px 0; font-size: 16px; color: #111111;"><strong>Use code:</strong> %s%s</p>',
                e($this->promotion->coupon_code),
                (float) $this->promotion->discount_percent > 0
                    ? ' for ' . e((string) (float) $this->promotion->discount_percent) . '% off at checkout'
                    : '',
            );
        }

        $imageHtml = '';
        if (! empty($this->promotion->image_url)) {
            $imageHtml = sprintf(
                '<div style="margin-bottom: 20px;"><img src="%s" alt="Promotion image" style="max-width:100%%;border-radius:12px;" /></div>',
                e($this->promotion->image_url),
            );
        }

        return sprintf(
            '<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif; background-color:#f5f5f7; margin:0; padding:0;">
  <table width="100%%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:16px; padding:32px;">
          <tr>
            <td style="text-align:center; padding-bottom:24px;">
              <h1 style="margin:0; font-size:28px; color:#111111;">%s</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:20px; color:#333333; font-size:16px; line-height:1.6;">
              %s
            </td>
          </tr>
          <tr>
            <td>
              %s
            </td>
          </tr>
          <tr>
            <td style="color:#333333; font-size:16px; line-height:1.6;">
              %s
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; color:#666666; font-size:14px; line-height:1.5;">
              <p style="margin:0;">This offer is available from %s to %s.</p>
              <p style="margin:8px 0 0 0;">Thank you for being part of our pastry family!</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px; border-top:1px solid #eeeeee; color:#666666; font-size:13px; line-height:1.5;">
              <p style="margin:0 0 12px 0;">No longer want promotional emails?</p>
              <a href="%s" style="display:inline-block; padding:10px 16px; border:1px solid #999999; border-radius:6px; color:#333333; text-decoration:none;">Unsubscribe from promotions</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
            e($this->promotion->title),
            e($this->promotion->title),
            nl2br(e($this->promotion->description)),
            $imageHtml,
            $couponHtml,
            e($this->promotion->starts_at->format('F j, Y')),
            e($this->promotion->ends_at->format('F j, Y')),
            e($unsubscribeUrl),
        );
    }
}
