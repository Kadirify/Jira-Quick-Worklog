# Gizlilik Politikası — Jira Quick Worklog

_Son güncelleme: 1 Temmuz 2026_

Jira Quick Worklog ("eklenti"), Jira Cloud üzerinde worklog (çalışma süresi)
girişlerini hızlandıran bir Chrome uzantısıdır. Gizliliğine önem veriyoruz. Bu
politika, eklentinin hangi verileri işlediğini ve nasıl kullandığını açıklar.

## Toplanan / işlenen veriler

Eklenti, yalnızca çalışması için gerekli olan şu bilgileri **senin cihazında**
saklar:

- **Jira adresi** (ör. `https://sirket.atlassian.net`)
- **E-posta adresin** (Jira kimlik doğrulaması için)
- **Jira API token'ın** (kimlik doğrulama bilgisi)
- **Tercihlerin** (günlük hedef, başlangıç saati, JQL sorgusu, favori işler,
  eklediğin hesaplar)

Ayrıca eklenti, seçtiğin Jira hesabıyla senin adına Jira'dan **iş (issue) ve
worklog verilerini** okur ve worklog ekler/siler. Bu veriler yalnızca arayüzde
gösterilmek için geçici olarak kullanılır.

## Bu veriler nerede saklanır ve nereye gider

- Tüm ayarların ve token'ın **yalnızca senin tarayıcının yerel depolamasında**
  (`chrome.storage.local`) tutulur.
- Bu bilgiler **bizim ya da üçüncü bir tarafın sunucularına gönderilmez**.
  Google hesabına senkronlanmaz.
- Eklentinin yaptığı tek ağ isteği, **senin girdiğin Jira adresine** (Atlassian
  Cloud) HTTPS üzerinden yapılan Jira REST API çağrılarıdır. Kimlik bilgilerin
  yalnızca bu isteklerde, doğrudan Jira'ya gönderilir.

## Verilerin kullanımı

- Veriler **yalnızca** eklentinin tek amacı için — Jira worklog girişleri ve
  iş listeleme — kullanılır.
- Verilerini **satmıyoruz**, üçüncü taraflarla **paylaşmıyoruz** ve reklam,
  analiz, kredi değerlendirmesi gibi amaçlarla kullanmıyoruz.
- Eklentide izleme (tracking), analytics veya çerez tabanlı takip **yoktur**.

## Verilerin silinmesi

Ayarlarını ve token'ını istediğin zaman eklenti ayarlarından değiştirebilir ya
da eklentiyi kaldırarak tüm yerel verileri silebilirsin. Token'ının
geçerliliğini Atlassian hesabından da iptal edebilirsin:
https://id.atlassian.com/manage-profile/security/api-tokens

## İletişim

Soru veya talepler için: proje deposu üzerinden iletişime geçebilirsin —
https://github.com/Kadirify/Jira-Quick-Worklog

---

# Privacy Policy — Jira Quick Worklog (English)

_Last updated: July 1, 2026_

Jira Quick Worklog (the "extension") is a Chrome extension that speeds up logging
work (worklogs) on Jira Cloud.

**Data processed** — stored only on your device (`chrome.storage.local`): your
Jira URL, email address, Jira API token (authentication), and preferences
(daily target, JQL, favorites, accounts). The extension also reads Jira issue
and worklog data and creates/deletes worklogs on your behalf; this is used only
to display the interface.

**Where it goes** — Your settings and token stay in your browser's local
storage. They are **never sent to us or any third party** and are not synced to
your Google account. The extension's only network requests are Jira REST API
calls to the Jira address **you enter**, over HTTPS. Your credentials are sent
only to your own Jira instance.

**Use** — Data is used solely for the extension's single purpose (logging Jira
worklogs and listing issues). We do **not** sell or share your data, and do not
use it for advertising, analytics, or creditworthiness. The extension contains
no tracking or analytics.

**Deletion** — Change your settings anytime, or uninstall the extension to
remove all local data. You can revoke your token at
https://id.atlassian.com/manage-profile/security/api-tokens

**Contact** — https://github.com/Kadirify/Jira-Quick-Worklog
