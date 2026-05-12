import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Play, Trash2, Download, RefreshCw,
  Flame, TrendingUp, Snowflake, Target, ChevronDown,
  ExternalLink, CheckCircle, XCircle, MessageSquare, ThumbsUp,
  AlertCircle, Loader2,
} from 'lucide-react';
import type {
  LinkedInCampaign, LinkedInLead, CampaignStats, LeadStatus,
} from '../types/linkedin';
import {
  getCampaigns, createCampaign, deleteCampaign, runCampaign,
  getCampaignStats, getLeads, updateLeadStatus, exportCsv, exportExcel,
} from '../services/linkedinAPI';

// ── Score badge ──────────────────────────────────────────────────────────────

const ScoreBadge = ({ score }: { score: number }) => {
  if (score >= 50)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        <Flame size={11} /> {score} Chaud
      </span>
    );
  if (score >= 20)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
        <TrendingUp size={11} /> {score} Tiède
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
      <Snowflake size={11} /> {score} Froid
    </span>
  );
};

// ── Status badge ─────────────────────────────────────────────────────────────

const LeadStatusBadge = ({ status }: { status: LeadStatus }) => {
  const map: Record<LeadStatus, { label: string; cls: string }> = {
    new: { label: 'Nouveau', cls: 'bg-blue-100 text-blue-700' },
    contacted: { label: 'Contacté', cls: 'bg-yellow-100 text-yellow-700' },
    qualified: { label: 'Qualifié', cls: 'bg-green-100 text-green-700' },
    disqualified: { label: 'Disqualifié', cls: 'bg-slate-100 text-slate-500' },
  };
  const { label, cls } = map[status] ?? map.new;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
};

// ── Campaign status indicator ─────────────────────────────────────────────────

const CampaignStatusDot = ({ status }: { status: LinkedInCampaign['status'] }) => {
  if (status === 'running')
    return <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />;
  if (status === 'completed')
    return <span className="flex h-2 w-2 rounded-full bg-green-500" />;
  if (status === 'failed')
    return <span className="flex h-2 w-2 rounded-full bg-red-500" />;
  return <span className="flex h-2 w-2 rounded-full bg-slate-300" />;
};

// ── New campaign modal ────────────────────────────────────────────────────────

interface NewCampaignModalProps {
  onClose: () => void;
  onCreated: (c: LinkedInCampaign) => void;
}
const NewCampaignModal = ({ onClose, onCreated }: NewCampaignModalProps) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [maxPosts, setMaxPosts] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name || !url) { setError('Nom et URL sont obligatoires'); return; }
    setLoading(true);
    try {
      const campaign = await createCampaign({
        name,
        competitor_linkedin_url: url,
        target_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        max_posts: maxPosts,
      });
      onCreated(campaign);
      onClose();
    } catch {
      setError('Erreur lors de la création de la campagne');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Nouvelle campagne de scraping
        </h2>

        {error && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la campagne</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Concurrents Île-de-France"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL LinkedIn du concurrent</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.linkedin.com/company/audioprothesiste-xyz"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Mots-clés prioritaires <span className="text-slate-400">(séparés par virgule)</span>
            </label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="audioprothésiste, ORL, sourd, malentendant"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nombre de posts à analyser <span className="text-slate-400">(max 50)</span>
            </label>
            <input
              type="number"
              min={1}
              max={50}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={maxPosts}
              onChange={(e) => setMaxPosts(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 rounded-lg py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 bg-[#0A66C2] text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Lead row ─────────────────────────────────────────────────────────────────

const LeadRow = ({
  lead,
  onStatusChange,
}: {
  lead: LinkedInLead;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) => {
  const [open, setOpen] = useState(false);

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: 'new', label: 'Nouveau' },
    { value: 'contacted', label: 'Contacté' },
    { value: 'qualified', label: 'Qualifié' },
    { value: 'disqualified', label: 'Disqualifié' },
  ];

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {lead.profile_picture_url ? (
            <img
              src={lead.profile_picture_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-500">
              {lead.full_name?.charAt(0) ?? '?'}
            </div>
          )}
          <div>
            <a
              href={lead.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-900 hover:text-[#0A66C2] flex items-center gap-1"
            >
              {lead.full_name ?? 'Inconnu'}
              <ExternalLink size={11} />
            </a>
            <p className="text-xs text-slate-500 truncate max-w-[240px]">{lead.headline ?? '—'}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">{lead.company ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-500">{lead.location ?? '—'}</td>
      <td className="px-4 py-3">
        <ScoreBadge score={lead.score} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <ThumbsUp size={11} />
            {lead.engagements.filter((e) => e.engagement_type === 'like').length}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />
            {lead.engagements.filter((e) => e.engagement_type === 'comment').length}
          </span>
          {lead.is_keyword_match && (
            <span title="Correspond aux mots-clés">
              <Target size={11} className="text-purple-500" />
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-sm"
          >
            <LeadStatusBadge status={lead.status} />
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {open && (
            <div className="absolute left-0 top-7 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    onStatusChange(lead.id, opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${
                    lead.status === opt.value ? 'font-semibold text-[#0A66C2]' : 'text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {lead.last_engagement_at
          ? new Date(lead.last_engagement_at).toLocaleDateString('fr-FR')
          : '—'}
      </td>
    </tr>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInLeadsPage() {
  const [campaigns, setCampaigns] = useState<LinkedInCampaign[]>([]);
  const [selected, setSelected] = useState<LinkedInCampaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [leads, setLeads] = useState<LinkedInLead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<'' | 'hot' | 'warm' | 'cold'>('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [kwFilter, setKwFilter] = useState<boolean | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const PAGE_SIZE = 20;

  // Polling: refresh running campaigns every 5s
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const hasRunning = campaigns.some((c) => c.status === 'running' || c.status === 'pending');
    if (hasRunning) {
      interval = setInterval(refreshCampaigns, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [campaigns]);

  const refreshCampaigns = useCallback(async () => {
    const data = await getCampaigns();
    setCampaigns(data);
    if (selected) {
      const updated = data.find((c) => c.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [selected]);

  useEffect(() => { refreshCampaigns(); }, []);

  const loadLeads = useCallback(async () => {
    if (!selected) return;
    setLoadingLeads(true);
    try {
      const res = await getLeads(selected.id, {
        page,
        page_size: PAGE_SIZE,
        category: categoryFilter || undefined,
        status: statusFilter || undefined,
        keyword_match: kwFilter,
        sort_by: 'score',
        order: 'desc',
      });
      setLeads(res.items);
      setTotalLeads(res.total);
    } finally {
      setLoadingLeads(false);
    }
  }, [selected, page, categoryFilter, statusFilter, kwFilter]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const loadStats = useCallback(async () => {
    if (!selected) return;
    const s = await getCampaignStats(selected.id);
    setStats(s);
  }, [selected]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleRun = async (campaign: LinkedInCampaign) => {
    await runCampaign(campaign.id);
    await refreshCampaigns();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette campagne et tous ses leads ?')) return;
    await deleteCampaign(id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) { setSelected(null); setLeads([]); setStats(null); }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    await updateLeadStatus(leadId, newStatus);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
  };

  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar — campaigns */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users size={16} className="text-[#0A66C2]" />
              Campagnes
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="p-1.5 bg-[#0A66C2] text-white rounded-lg hover:bg-blue-700"
              title="Nouvelle campagne"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {campaigns.length === 0 && (
            <p className="text-xs text-slate-400 p-4 text-center">
              Aucune campagne — créez-en une pour commencer
            </p>
          )}
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelected(c); setPage(1); }}
              className={`w-full text-left rounded-xl p-3 transition-colors ${
                selected?.id === c.id
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-900 truncate flex-1">{c.name}</span>
                <CampaignStatusDot status={c.status} />
              </div>
              <p className="text-xs text-slate-500 truncate">{c.competitor_linkedin_url}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-400">{c.leads_count} leads</span>
                {c.status === 'running' && (
                  <span className="text-xs text-blue-500 font-medium">En cours…</span>
                )}
                {c.status === 'failed' && (
                  <span className="text-xs text-red-500 font-medium">Erreur</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <Users size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium">Sélectionnez une campagne</p>
            <p className="text-sm mt-1">ou créez-en une nouvelle via le bouton +</p>
          </div>
        ) : (
          <>
            {/* Campaign header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{selected.name}</h1>
                <a
                  href={selected.competitor_linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#0A66C2] hover:underline flex items-center gap-1 mt-0.5"
                >
                  {selected.competitor_linkedin_url}
                  <ExternalLink size={11} />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { loadLeads(); loadStats(); refreshCampaigns(); }}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
                  title="Actualiser"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  onClick={() => handleRun(selected)}
                  disabled={selected.status === 'running'}
                  className="flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {selected.status === 'running' ? (
                    <><Loader2 size={14} className="animate-spin" /> Scraping…</>
                  ) : (
                    <><Play size={14} /> Lancer le scraping</>
                  )}
                </button>
                <div className="relative group">
                  <button className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
                    <Download size={14} /> Exporter
                  </button>
                  <div className="absolute right-0 top-10 z-10 hidden group-hover:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                    <button
                      onClick={() => exportCsv(selected.id, selected.name)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => exportExcel(selected.id, selected.name)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700"
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="p-2 border border-red-100 rounded-lg hover:bg-red-50 text-red-400"
                  title="Supprimer la campagne"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Error banner */}
            {selected.status === 'failed' && selected.error_message && (
              <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{selected.error_message}</span>
              </div>
            )}

            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<Flame size={18} className="text-red-500" />}
                  label="Leads chauds"
                  value={stats.hot_leads}
                  sub="score ≥ 50"
                  color="red"
                />
                <StatCard
                  icon={<TrendingUp size={18} className="text-orange-500" />}
                  label="Leads tièdes"
                  value={stats.warm_leads}
                  sub="score 20–49"
                  color="orange"
                />
                <StatCard
                  icon={<Snowflake size={18} className="text-slate-400" />}
                  label="Leads froids"
                  value={stats.cold_leads}
                  sub="score < 20"
                  color="slate"
                />
                <StatCard
                  icon={<Target size={18} className="text-purple-500" />}
                  label="Mots-clés"
                  value={stats.keyword_matches}
                  sub="correspondances"
                  color="purple"
                />
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-slate-600">Filtrer :</span>
              {(['', 'hot', 'warm', 'cold'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setCategoryFilter(cat); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    categoryFilter === cat
                      ? 'bg-[#0A66C2] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === '' ? 'Tous' : cat === 'hot' ? '🔥 Chauds' : cat === 'warm' ? '📈 Tièdes' : '❄️ Froids'}
                </button>
              ))}
              <button
                onClick={() => { setKwFilter(kwFilter === true ? undefined : true); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  kwFilter === true
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🎯 Mots-clés
              </button>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as LeadStatus | ''); setPage(1); }}
                className="ml-auto text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Tous les statuts</option>
                <option value="new">Nouveau</option>
                <option value="contacted">Contacté</option>
                <option value="qualified">Qualifié</option>
                <option value="disqualified">Disqualifié</option>
              </select>
              <span className="text-xs text-slate-400">{totalLeads} lead{totalLeads !== 1 ? 's' : ''}</span>
            </div>

            {/* Leads table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {loadingLeads ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 size={24} className="animate-spin mr-2" />
                  Chargement…
                </div>
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users size={32} className="mb-2 opacity-30" />
                  <p className="text-sm">
                    {selected.status === 'completed'
                      ? 'Aucun lead trouvé avec ces filtres'
                      : 'Lancez le scraping pour générer des leads'}
                  </p>
                </div>
              ) : (
                <>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Personne', 'Entreprise', 'Localisation', 'Score', 'Engagements', 'Statut', 'Dernière activité'].map(
                          (h) => (
                            <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leads.map((lead) => (
                        <LeadRow key={lead.id} lead={lead} onStatusChange={handleStatusChange} />
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100">
                      <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-3 py-1 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        Préc.
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {page} / {totalPages}
                      </span>
                      <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1 rounded-lg text-sm border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                      >
                        Suiv.
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {showModal && (
        <NewCampaignModal
          onClose={() => setShowModal(false)}
          onCreated={(c) => setCampaigns((prev) => [c, ...prev])}
        />
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

const StatCard = ({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: 'red' | 'orange' | 'slate' | 'purple';
}) => {
  const bg = {
    red: 'bg-red-50',
    orange: 'bg-orange-50',
    slate: 'bg-slate-50',
    purple: 'bg-purple-50',
  }[color];

  return (
    <div className={`${bg} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-slate-600">{label}</span></div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
};
