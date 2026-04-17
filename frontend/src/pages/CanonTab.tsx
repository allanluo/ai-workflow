import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectAssets,
  createAsset,
  createAssetVersion,
  updateAsset,
  fetchProjectWorkflowRuns,
  fetchProjectWorkflows,
  generateCharacterImage,
  type Asset,
  type AssetVersion,
} from '../lib/api';
import { Button, Input, Textarea, Select } from '../components/common';
import { showToast } from '../stores';
import type { CanonListItem } from './CanonPage/CanonListPanel';

interface CanonTabProps {
  projectId: string;
}

interface CanonCharacterAppearance {
  face?: string;
  hair?: string;
  clothing?: string;
  shoes?: string;
  hat?: string;
  accessories?: string;
}

interface CanonCharacterRelationship {
  to: string;
  type: string;
}

interface CanonCharacter {
  name: string;
  role: string;
  description: string;
  image_url?: string;
  appearance?: CanonCharacterAppearance;
  personality?: string;
  relationships?: CanonCharacterRelationship[];
}

interface CanonLocation {
  name: string;
  description: string;
  mood?: string;
}

interface CanonEquipment {
  name: string;
  description: string;
  owner?: string;
}

interface CanonContent {
  [key: string]: unknown;
  summary: string;
  themes: string[];
  tone: string;
  colorPalette: string[];
  worldRules: string[];
  characters: CanonCharacter[];
  locations: CanonLocation[];
  equipment: CanonEquipment[];
  continuity: string[];
}

const emptyCanon: CanonContent = {
  summary: '',
  themes: [],
  tone: '',
  colorPalette: [],
  worldRules: [],
  characters: [],
  locations: [],
  equipment: [],
  continuity: [],
};

export function CanonTab({ projectId }: CanonTabProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id: projectIdParam } = useParams();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<CanonContent>(emptyCanon);
  const [generatingCharacterIndex, setGeneratingCharacterIndex] = useState<number | null>(null);

  const {
    data: allAssets,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['project-assets', projectId],
    queryFn: () => fetchProjectAssets(projectId),
    enabled: Boolean(projectId),
  });

  const { data: workflowRunMap } = useQuery({
    queryKey: ['workflow-runs', projectId],
    queryFn: async () => fetchProjectWorkflowRuns(projectId),
    enabled: Boolean(projectId),
  });

  const { data: workflowMap } = useQuery({
    queryKey: ['workflows-list', projectId],
    queryFn: async () => {
      const allWorkflows = await fetchProjectWorkflows(projectId);
      const map: Record<string, string> = {};
      for (const wf of allWorkflows) {
        map[wf.id] = wf.title || wf.id;
      }
      return map;
    },
    enabled: Boolean(projectId),
  });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: asset => {
      queryClient.setQueryData<Asset[]>(['project-assets', projectId], prev =>
        prev ? [asset, ...prev] : [asset]
      );
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      setSelectedAssetId(asset.id);
      setEditContent(emptyCanon);
      setIsEditing(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      assetId,
      content,
    }: {
      assetId: string;
      content: CanonContent;
      close?: boolean;
    }) =>
      createAssetVersion(assetId, {
        content: content as unknown as Record<string, unknown>,
        source_mode: 'manual',
        status: 'draft',
        make_current: true,
      }),
    onSuccess: (_assetVersion: AssetVersion, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      if (variables.close !== false) {
        setIsEditing(false);
      }
      showToast({ type: 'success', title: 'Saved', message: 'Canon updated.' });
    },
    onError: err => {
      showToast({
        type: 'error',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await updateAsset(assetId, { status: 'deprecated' });
      return true;
    },
    onSuccess: (_deleted, assetId) => {
      queryClient.setQueryData<Asset[]>(['project-assets', projectId], prev =>
        (prev ?? []).map(a => (a.id === assetId ? { ...a, status: 'deprecated' } : a))
      );
      queryClient.invalidateQueries({ queryKey: ['project-assets', projectId] });
      setSelectedAssetId(prev => (prev === assetId ? null : prev));
      setIsEditing(false);
      setEditContent(emptyCanon);
      showToast({ type: 'success', title: 'Deleted', message: 'Canon removed from the list.' });
    },
    onError: err => {
      showToast({
        type: 'error',
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    },
  });

  const generateImageMutation = useMutation({
    mutationFn: generateCharacterImage,
  });

  const canonAssets = useMemo(
    () => (allAssets ?? []).filter(a => a.asset_type === 'canon_text' && a.status !== 'deprecated'),
    [allAssets]
  );
  const sortedCanonAssets = useMemo(
    () => [...canonAssets].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [canonAssets]
  );

  useEffect(() => {
    if (!selectedAssetId && sortedCanonAssets.length > 0) {
      setSelectedAssetId(sortedCanonAssets[0].id);
    }
  }, [selectedAssetId, sortedCanonAssets]);

  const workflowRunIds = [
    ...new Set(canonAssets.map(a => a.current_version?.workflow_run_id).filter(Boolean)),
  ];
  const filteredRunMap = workflowRunMap?.filter(r => workflowRunIds.includes(r.id)) || [];

  const handleCreateCanon = () => {
    createMutation.mutate({
      projectId,
      asset_type: 'canon_text',
      asset_category: 'story',
      title: 'New Canon Document',
      content: emptyCanon as unknown as Record<string, unknown>,
      metadata: {},
      source_mode: 'manual',
    });
  };

  const selectedAsset: Asset | null =
    sortedCanonAssets.find(a => a.id === selectedAssetId) ?? null;

  const getCanonListTitle = (asset: Asset): string => {
    const title = typeof asset.title === 'string' ? asset.title.trim() : '';
    if (!title) return 'Untitled Canon';
    if (/extract[_\-\s]?canon\s*output/i.test(title)) return 'Generated Canon';
    if (/canon[_\-\s]?bundle/i.test(title)) return 'Generated Canon';
    return title;
  };

  const getCanonListSubtitle = (asset: Asset): string => {
    const raw =
      asset.current_version?.content ?? asset.current_approved_version?.content ?? ({} as unknown);

    if (!raw || typeof raw !== 'object') return 'No summary';
    const record = raw as Record<string, unknown>;

    const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
    if (summary) return summary;

    const tone = typeof record.tone === 'string' ? record.tone.trim() : '';
    const themes = Array.isArray(record.themes)
      ? (record.themes.filter(t => typeof t === 'string') as string[])
      : [];

    const fallback = [
      tone ? `Tone: ${tone}` : null,
      themes.length > 0 ? `Themes: ${themes.slice(0, 3).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    if (fallback) return fallback;

    const text = typeof record.text === 'string' ? record.text.trim() : '';
    if (text) return text.slice(0, 200);

    return 'No summary';
  };

  const canonListItems: CanonListItem[] = useMemo(() => {
    return sortedCanonAssets.map(asset => {
      return {
        assetId: asset.id,
        title: getCanonListTitle(asset),
        subtitle: getCanonListSubtitle(asset),
        updatedAt: asset.updated_at,
      };
    });
  }, [sortedCanonAssets]);

  const handleSelectAssetId = (assetId: string) => {
    setSelectedAssetId(assetId);
    setIsEditing(false);
  };

  const handleBeginEdit = () => {
    if (!selectedAsset) return;
    setEditContent(getContent(selectedAsset));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedAsset) {
      updateMutation.mutate({ assetId: selectedAsset.id, content: editContent, close: true });
    }
  };

  const handleDelete = () => {
    if (!selectedAsset) return;
    const title = selectedAsset.title?.trim() || 'Untitled Canon';
    const ok = window.confirm(`Delete "${title}"?\n\nThis will remove it from the list.`);
    if (!ok) return;
    deleteMutation.mutate(selectedAsset.id);
  };

  useEffect(() => {
    if (!selectedAssetId) {
      setEditContent(emptyCanon);
      setIsEditing(false);
      return;
    }
    if (!selectedAsset) return;
    // When selection/version changes, refresh the draft only if we're not actively editing.
    if (!isEditing) setEditContent(getContent(selectedAsset));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssetId, selectedAsset?.current_asset_version_id]);

  if (!projectId) {
    return <div className="p-4 text-red-500">No projectId provided</div>;
  }

  if (isLoading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading assets...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {String(error)}</div>;
  }

  const addCharacter = () => {
    setEditContent(prev => ({
      ...prev,
      characters: [...prev.characters, { name: '', role: 'supporting', description: '' }],
    }));
  };

  const removeCharacter = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.filter((_, i) => i !== index),
    }));
  };

  const patchCharacter = (index: number, patch: Partial<CanonCharacter>) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const updateCharacterTextField = (
    index: number,
    field: 'name' | 'role' | 'description' | 'image_url' | 'personality',
    value: string
  ) => {
    patchCharacter(index, { [field]: value } as Partial<CanonCharacter>);
  };

  const updateCharacterAppearance = (
    index: number,
    field: keyof CanonCharacterAppearance,
    value: string
  ) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.map((c, i) => {
        if (i !== index) return c;
        const nextAppearance: CanonCharacterAppearance = { ...(c.appearance ?? {}) };
        if (value.trim()) nextAppearance[field] = value;
        else delete nextAppearance[field];
        const hasAny = Object.values(nextAppearance).some(v => typeof v === 'string' && v.trim());
        return {
          ...c,
          appearance: hasAny ? nextAppearance : undefined,
        };
      }),
    }));
  };

  const addCharacterRelationship = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.map((c, i) => {
        if (i !== index) return c;
        const next = [...(c.relationships ?? []), { to: '', type: '' }];
        return { ...c, relationships: next };
      }),
    }));
  };

  const updateCharacterRelationship = (
    charIndex: number,
    relIndex: number,
    field: keyof CanonCharacterRelationship,
    value: string
  ) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.map((c, i) => {
        if (i !== charIndex) return c;
        const rels = [...(c.relationships ?? [])];
        rels[relIndex] = { ...(rels[relIndex] ?? { to: '', type: '' }), [field]: value };
        return { ...c, relationships: rels };
      }),
    }));
  };

  const removeCharacterRelationship = (charIndex: number, relIndex: number) => {
    setEditContent(prev => ({
      ...prev,
      characters: prev.characters.map((c, i) => {
        if (i !== charIndex) return c;
        const next = (c.relationships ?? []).filter((_, idx) => idx !== relIndex);
        return { ...c, relationships: next.length > 0 ? next : undefined };
      }),
    }));
  };

  const buildCharacterImagePrompt = (
    canon: CanonContent,
    char: CanonContent['characters'][number]
  ) => {
    const details = [
      char.name ? `Name: ${char.name}.` : null,
      char.role ? `Role: ${char.role}.` : null,
      char.description ? `Description: ${char.description}.` : null,
      canon.tone ? `Tone: ${canon.tone}.` : null,
      canon.themes?.length ? `Themes: ${canon.themes.slice(0, 4).join(', ')}.` : null,
      canon.worldRules?.length ? `World notes: ${canon.worldRules.slice(0, 3).join(' ')}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return [
      'Create a high-quality character portrait for a story canon.',
      details,
      'Portrait only, neutral background, consistent style, no text, no watermark.',
    ]
      .filter(Boolean)
      .join(' ');
  };

  const characterInitials = (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return '?';
    const parts = cleaned.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join('');
  };

  const renderAvatar = (imageUrl: string | undefined, label: string) => {
    return (
      <div
        className="h-7 w-7 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0"
        title={label}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[10px] font-semibold text-[var(--text-muted)]">
            {characterInitials(label)}
          </span>
        )}
      </div>
    );
  };

  const handleGenerateCharacterImage = async (index: number) => {
    const char = editContent.characters[index];
    if (!char) return;

    const prompt = buildCharacterImagePrompt(editContent, char);

    setGeneratingCharacterIndex(index);
    try {
      const result = await generateImageMutation.mutateAsync({
        projectId,
        prompt,
        width: 768,
        height: 768,
      });

      if (!result.image_url) {
        showToast({
          type: 'warning',
          title: 'Image generation queued',
          message: `No image URL returned (status: ${result.status}).`,
        });
        return;
      }

      const nextContent: CanonContent = {
        ...editContent,
        characters: editContent.characters.map((c, i) =>
          i === index ? { ...c, image_url: result.image_url } : c
        ),
      };
      setEditContent(nextContent);

      showToast({
        type: 'success',
        title: 'Character image generated',
        message: `${char.name || 'Character'} portrait ready.`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Image generation failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setGeneratingCharacterIndex(null);
    }
  };

  const addLocation = () => {
    setEditContent(prev => ({
      ...prev,
      locations: [...prev.locations, { name: '', description: '' }],
    }));
  };

  const removeLocation = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }));
  };

  const updateLocation = (index: number, field: keyof CanonLocation, value: string) => {
    setEditContent(prev => ({
      ...prev,
      locations: prev.locations.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }));
  };

  const addTheme = () => {
    setEditContent(prev => ({
      ...prev,
      themes: [...prev.themes, ''],
    }));
  };

  const updateTheme = (index: number, value: string) => {
    setEditContent(prev => ({
      ...prev,
      themes: prev.themes.map((t, i) => (i === index ? value : t)),
    }));
  };

  const removeTheme = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      themes: prev.themes.filter((_, i) => i !== index),
    }));
  };

  const addWorldRule = () => {
    setEditContent(prev => ({
      ...prev,
      worldRules: [...prev.worldRules, ''],
    }));
  };

  const updateWorldRule = (index: number, value: string) => {
    setEditContent(prev => ({
      ...prev,
      worldRules: prev.worldRules.map((r, i) => (i === index ? value : r)),
    }));
  };

  const removeWorldRule = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      worldRules: prev.worldRules.filter((_, i) => i !== index),
    }));
  };

  const addColor = () => {
    setEditContent(prev => ({
      ...prev,
      colorPalette: [...(prev.colorPalette ?? []), ''],
    }));
  };

  const updateColor = (index: number, value: string) => {
    setEditContent(prev => ({
      ...prev,
      colorPalette: (prev.colorPalette ?? []).map((c, i) => (i === index ? value : c)),
    }));
  };

  const removeColor = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      colorPalette: (prev.colorPalette ?? []).filter((_, i) => i !== index),
    }));
  };

  const addEquipment = () => {
    setEditContent(prev => ({
      ...prev,
      equipment: [...(prev.equipment ?? []), { name: '', description: '', owner: '' }],
    }));
  };

  const updateEquipment = (index: number, field: keyof CanonEquipment, value: string) => {
    setEditContent(prev => ({
      ...prev,
      equipment: (prev.equipment ?? []).map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    }));
  };

  const removeEquipment = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      equipment: (prev.equipment ?? []).filter((_, i) => i !== index),
    }));
  };

  const addContinuity = () => {
    setEditContent(prev => ({
      ...prev,
      continuity: [...(prev.continuity ?? []), ''],
    }));
  };

  const updateContinuity = (index: number, value: string) => {
    setEditContent(prev => ({
      ...prev,
      continuity: (prev.continuity ?? []).map((c, i) => (i === index ? value : c)),
    }));
  };

  const removeContinuity = (index: number) => {
    setEditContent(prev => ({
      ...prev,
      continuity: (prev.continuity ?? []).filter((_, i) => i !== index),
    }));
  };

  const normalizeCanonContent = (raw: unknown): CanonContent => {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const normalized: Record<string, unknown> = { ...obj };

    const summary = typeof obj.summary === 'string' ? obj.summary : '';
    const tone = typeof obj.tone === 'string' ? obj.tone : '';

    const themes = Array.isArray(obj.themes)
      ? obj.themes.filter((t): t is string => typeof t === 'string').map(t => t.trim()).filter(Boolean)
      : typeof obj.themes === 'string'
        ? obj.themes
            .split(/[,;]/)
            .map(t => t.trim())
            .filter(Boolean)
        : [];

    const colorPaletteRaw = (obj.colorPalette ?? obj.color_palette) as unknown;
    const colorPalette = Array.isArray(colorPaletteRaw)
      ? colorPaletteRaw.filter((c): c is string => typeof c === 'string').map(c => c.trim()).filter(Boolean)
      : typeof colorPaletteRaw === 'string'
        ? colorPaletteRaw
            .split(/[,;]/)
            .map(c => c.trim())
            .filter(Boolean)
        : [];

    const worldRulesRaw = (obj.worldRules ?? obj.world_rules) as unknown;
    const worldRules = Array.isArray(worldRulesRaw)
      ? worldRulesRaw.filter((r): r is string => typeof r === 'string').map(r => r.trim()).filter(Boolean)
      : typeof worldRulesRaw === 'string'
        ? [worldRulesRaw].map(r => r.trim()).filter(Boolean)
        : [];

    const continuityRaw = (obj.continuity ?? obj.continuity_constraints ?? obj.continuityConstraints) as unknown;
    const continuity = Array.isArray(continuityRaw)
      ? continuityRaw.filter((r): r is string => typeof r === 'string').map(r => r.trim()).filter(Boolean)
      : typeof continuityRaw === 'string'
        ? [continuityRaw].map(r => r.trim()).filter(Boolean)
        : [];

    const locations = Array.isArray(obj.locations)
      ? obj.locations.flatMap(l => {
          if (!l || typeof l !== 'object') return [];
          const lo = l as Record<string, unknown>;
          const base: Record<string, unknown> = { ...lo };
          const name = typeof lo.name === 'string' ? lo.name : '';
          const description = typeof lo.description === 'string' ? lo.description : '';
          const mood = typeof lo.mood === 'string' ? lo.mood : undefined;
          if (!name && !description && !mood) return [];
          base.name = name;
          base.description = description;
          if (mood) base.mood = mood;
          return [base as unknown as CanonLocation];
        })
      : [];

    const equipment = Array.isArray(obj.equipment)
      ? obj.equipment.flatMap(e => {
          if (!e || typeof e !== 'object') return [];
          const eo = e as Record<string, unknown>;
          const base: Record<string, unknown> = { ...eo };
          const name = typeof eo.name === 'string' ? eo.name : '';
          const description = typeof eo.description === 'string' ? eo.description : '';
          const owner = typeof eo.owner === 'string' ? eo.owner : undefined;
          if (!name && !description) return [];
          base.name = name;
          base.description = description;
          if (owner) base.owner = owner;
          return [base as unknown as CanonEquipment];
        })
      : [];

    const characters = Array.isArray(obj.characters)
      ? obj.characters.flatMap(c => {
          if (!c || typeof c !== 'object') return [];
          const co = c as Record<string, unknown>;
          const base: Record<string, unknown> = { ...co };
          const name = typeof co.name === 'string' ? co.name : '';
          const role = typeof co.role === 'string' ? co.role : 'supporting';
          const description = typeof co.description === 'string' ? co.description : '';
          const image_url = typeof co.image_url === 'string' ? co.image_url : undefined;
          const personality = typeof co.personality === 'string' ? co.personality : undefined;

          let appearance: CanonCharacterAppearance | undefined;
          if (co.appearance && typeof co.appearance === 'object') {
            const ao = co.appearance as Record<string, unknown>;
            const next: CanonCharacterAppearance = {};
            const fields: (keyof CanonCharacterAppearance)[] = [
              'face',
              'hair',
              'clothing',
              'shoes',
              'hat',
              'accessories',
            ];
            for (const key of fields) {
              if (typeof ao[key] === 'string' && ao[key]) next[key] = ao[key] as string;
            }
            if (Object.keys(next).length > 0) appearance = next;
          }

          const relationships = Array.isArray(co.relationships)
            ? co.relationships.flatMap(r => {
                if (!r || typeof r !== 'object') return [];
                const ro = r as Record<string, unknown>;
                const to = typeof ro.to === 'string' ? ro.to : '';
                const type = typeof ro.type === 'string' ? ro.type : '';
                if (!to && !type) return [];
                return [{ to, type } satisfies CanonCharacterRelationship];
              })
            : undefined;

          if (!name && !description && !image_url && !personality && !appearance) return [];

          base.name = name;
          base.role = role;
          base.description = description;
          if (image_url) base.image_url = image_url;
          if (personality) base.personality = personality;
          if (appearance) base.appearance = appearance;
          if (relationships && relationships.length > 0) base.relationships = relationships;

          return [base as unknown as CanonCharacter];
        })
      : [];

    normalized.summary = summary;
    normalized.themes = themes;
    normalized.tone = tone;
    normalized.colorPalette = colorPalette;
    normalized.worldRules = worldRules;
    normalized.characters = characters;
    normalized.locations = locations;
    normalized.equipment = equipment;
    normalized.continuity = continuity;

    return normalized as CanonContent;
  };

  function getContent(asset: Asset): CanonContent {
    const rawContent =
      asset.current_version?.content || asset.current_approved_version?.content || {};

    if (rawContent && typeof rawContent === 'object') {
      const obj = rawContent as Record<string, unknown>;
      if (
        obj.summary ||
        obj.characters ||
        obj.locations ||
        obj.themes ||
        obj.tone ||
        obj.worldRules ||
        obj.world_rules ||
        obj.colorPalette ||
        obj.color_palette ||
        obj.equipment
      ) {
        return normalizeCanonContent(obj);
      }
    }

    if (
      rawContent &&
      typeof rawContent === 'object' &&
      'text' in rawContent &&
      typeof rawContent.text === 'string'
    ) {
      const text = rawContent.text;

      const result: CanonContent = {
        _raw: text,
        summary: '',
        characters: [],
        locations: [],
        themes: [],
        tone: '',
        colorPalette: [],
        worldRules: [],
        equipment: [],
        continuity: [],
      };

      // Summary - look for **Summary:** or **1. Summary:** or Summary:
      const summaryMatch = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*Summary\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*Summary)[\s\n]*[:\-]?\s*\n?([^\n#]+)/im
      );
      if (summaryMatch) result.summary = summaryMatch[1].trim().slice(0, 500);

      // Characters - look for **Characters:** or **1. Characters:** or Characters:
      const charsSection = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*Characters?\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*Characters?)[\s\n]*[:\-]?\s*\n([\s\S]*?)(?=\n\s*\*\*|\n\s*[0-9]+\.|\n\s*[A-Z][a-z]+:|$)/im
      );
      if (charsSection) {
        const charMatches = charsSection[1].matchAll(
          /(?:^|\n)\s*[\*\-\•]\s*\*\*([^\*]+)\*\*[:\s]+([^\n]+)/gm
        );
        for (const match of charMatches) {
          result.characters.push({
            name: match[1].trim(),
            role: 'supporting',
            description: match[2].trim().slice(0, 200),
          });
        }
      }

      // Locations
      const locsSection = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*Locations?\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*Locations?)[\s\n]*[:\-]?\s*\n([\s\S]*?)(?=\n\s*\*\*|\n\s*[0-9]+\.|\n\s*[A-Z][a-z]+:|$)/im
      );
      if (locsSection) {
        const locMatches = locsSection[1].matchAll(
          /(?:^|\n)\s*[\*\-\•]\s*\*\*([^\*]+)\*\*[:\s]+([^\n]+)/gm
        );
        for (const match of locMatches) {
          result.locations.push({
            name: match[1].trim(),
            description: match[2].trim().slice(0, 200),
          });
        }
      }

      // Themes
      const themesMatch = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*Themes?\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*Themes?)[\s\n]*[:\-]?\s*\n?([^\n]+)/im
      );
      if (themesMatch) {
        const themesStr = themesMatch[1].replace(/^\s*[\*\-\•]\s*/gm, '').trim();
        result.themes = themesStr
          .split(/[,;]/)
          .map(t => t.trim())
          .filter(Boolean)
          .slice(0, 10);
      }

      // Tone
      const toneMatch = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*Tone\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*Tone)[\s\n]*[:\-]?\s*\n?([^\n#]+)/im
      );
      if (toneMatch) result.tone = toneMatch[1].trim().slice(0, 200);

      // World Rules
      const rulesSection = text.match(
        /(?:\*\*\s*(?:\d+\.)?\s*World Rules?\s*:?\s*\*\*|^\s*(?:\d+\.)?\s*World Rules?)[\s\n]*[:\-]?\s*\n([\s\S]*?)(?=\n\s*\*\*|\n\s*[0-9]+\.|\n\s*[A-Z][a-z]+:|$)/im
      );
      if (rulesSection) {
        const ruleMatches = rulesSection[1].matchAll(/(?:^|\n)\s*[\*\-\•]\s*([^\n]+)/gm);
        for (const match of ruleMatches) {
          const rule = match[1].replace(/\*\*/g, '').trim();
          if (rule && rule.length < 200) {
            result.worldRules.push(rule);
          }
        }
      }

      if (
        result.summary ||
        result.characters.length > 0 ||
        result.themes.length > 0 ||
        result.tone ||
        result.worldRules.length > 0
      ) {
        return normalizeCanonContent(result);
      }

      // Try JSON code block
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (
            parsed &&
            typeof parsed === 'object' &&
            (parsed.summary || parsed.characters || parsed.themes)
          ) {
            return normalizeCanonContent(parsed);
          }
        } catch {}
      }
    }

    return emptyCanon;
  }

  const renderView = (content: CanonContent | undefined | null) => {
    if (!content || typeof content !== 'object') {
      return <p className="text-sm text-[var(--text-muted)]">No content yet</p>;
    }

    const normalized = normalizeCanonContent(content);
    const rawText =
      typeof normalized._raw === 'string'
        ? normalized._raw
        : typeof (content as Record<string, unknown>).text === 'string'
          ? ((content as Record<string, unknown>).text as string)
          : '';
    const hasStructured =
      Boolean(normalized.summary) ||
      normalized.characters.length > 0 ||
      normalized.locations.length > 0 ||
      normalized.themes.length > 0 ||
      Boolean(normalized.tone) ||
      normalized.colorPalette.length > 0 ||
      normalized.worldRules.length > 0 ||
      normalized.equipment.length > 0 ||
      normalized.continuity.length > 0;

    return (
      <div className="space-y-6">
        {normalized.summary && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">Summary</h4>
            <p className="text-sm text-[var(--text-primary)]">{normalized.summary}</p>
          </div>
        )}
        {normalized.characters.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              Characters
            </h4>
            <div className="space-y-2">
              {normalized.characters.map((char, i) => (
                <div key={i} className="p-3 bg-[var(--bg-hover)] rounded-lg">
                  <div className="flex gap-3">
                    <div className="h-14 w-14 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
                      {char.image_url ? (
                        <img
                          src={char.image_url}
                          alt={char.name || 'Character'}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                          {characterInitials(char.name || '')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {char.name || 'Unnamed'}
                        </span>
                        <span className="px-2 py-0.5 text-xs bg-[var(--accent)] text-white rounded">
                          {char.role}
                        </span>
                      </div>
                      {char.description && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">{char.description}</p>
                      )}
                      {char.personality && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          <span className="font-semibold text-[var(--text-secondary)]">
                            Personality:
                          </span>{' '}
                          {char.personality}
                        </p>
                      )}
                      {char.appearance && (
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                          {Object.entries(char.appearance).map(([k, v]) =>
                            typeof v === 'string' && v ? (
                              <div key={k} className="truncate">
                                <span className="font-semibold text-[var(--text-secondary)]">
                                  {k}:
                                </span>{' '}
                                {v}
                              </div>
                            ) : null
                          )}
                        </div>
                      )}
                      {char.relationships && char.relationships.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {char.relationships.map((rel, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs rounded bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-secondary)]"
                            >
                              {rel.type ? `${rel.type}: ` : ''}
                              {rel.to}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {normalized.locations.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              Locations
            </h4>
            <div className="space-y-1">
              {normalized.locations.map((loc, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0" />
                  <span className="font-medium text-[var(--text-primary)]">{loc.name}</span>
                  <span className="text-[var(--text-muted)]">
                    {loc.description ? `- ${loc.description}` : ''}
                    {loc.mood ? (loc.description ? ` · ${loc.mood}` : loc.mood) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {normalized.themes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">Themes</h4>
            <div className="flex flex-wrap gap-2">
              {normalized.themes.map((theme, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-sm bg-[var(--accent)] text-white rounded-full"
                >
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}
        {normalized.colorPalette.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              Color Palette
            </h4>
            <div className="flex flex-wrap gap-2">
              {normalized.colorPalette.map((color, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-sm bg-[var(--bg-input)] text-[var(--text-secondary)] rounded-full border border-[var(--border)]"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}
        {normalized.tone && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">Tone</h4>
            <p className="text-sm text-[var(--text-primary)]">{normalized.tone}</p>
          </div>
        )}
        {normalized.worldRules.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              World Rules
            </h4>
            <ul className="space-y-1">
              {normalized.worldRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] mt-1.5 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
        {normalized.equipment.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              Equipment
            </h4>
            <div className="space-y-2">
              {normalized.equipment.map((item, i) => (
                <div key={i} className="p-3 bg-[var(--bg-hover)] rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
                    {item.owner && (
                      <span className="text-xs text-[var(--text-muted)]">Owner: {item.owner}</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-sm text-[var(--text-muted)] mt-1">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {normalized.continuity.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
              Continuity
            </h4>
            <ul className="space-y-1">
              {normalized.continuity.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-primary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] mt-1.5 flex-shrink-0" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
        {rawText && (
          <details className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-elevated)] p-3">
            <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)] uppercase">
              {hasStructured ? 'Raw Output' : 'Raw Output (only)'}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--text-secondary)]">
              {rawText}
            </pre>
          </details>
        )}
      </div>
    );
  };

  const renderEditForm = () => (
    <div className="space-y-6">
      <Textarea
        id="canon-summary"
        label="Summary"
        value={editContent.summary}
        onChange={e => setEditContent(prev => ({ ...prev, summary: e.target.value }))}
        rows={3}
        placeholder="Brief summary..."
      />
      <Input
        id="canon-tone"
        label="Tone"
        value={editContent.tone}
        onChange={e => setEditContent(prev => ({ ...prev, tone: e.target.value }))}
        placeholder="e.g., Dark, Whimsical"
      />
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
            Color Palette
          </label>
          <button
            type="button"
            onClick={addColor}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {editContent.colorPalette.map((color, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-44">
                <Input
                  id={`canon-color-${i}`}
                  label={`Color ${i + 1}`}
                  value={color}
                  onChange={e => updateColor(i, e.target.value)}
                  placeholder="e.g., teal"
                />
              </div>
              <button type="button" onClick={() => removeColor(i)} className="text-red-500 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
            Characters
          </label>
          <button
            type="button"
            onClick={addCharacter}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {editContent.characters.map((char, i) => (
            <div key={i} className="p-3 bg-[var(--bg-hover)] rounded-lg space-y-2">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-input)] flex items-center justify-center flex-shrink-0">
                  {char.image_url ? (
                    <img
                      src={char.image_url}
                      alt={char.name || 'Character'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-[var(--text-muted)]">
                      {characterInitials(char.name || '')}
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Input
                        id={`canon-char-${i}-name`}
                        label="Name"
                        value={char.name}
                        onChange={e => updateCharacterTextField(i, 'name', e.target.value)}
                        placeholder="Name"
                      />
                    </div>
                    <div className="w-48">
                      <Select
                        id={`canon-char-${i}-role`}
                        label="Role"
                        value={char.role}
                        onChange={e => updateCharacterTextField(i, 'role', e.target.value)}
                        options={[
                          { value: 'protagonist', label: 'Protagonist' },
                          { value: 'antagonist', label: 'Antagonist' },
                          { value: 'supporting', label: 'Supporting' },
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCharacter(i)}
                      className="text-red-500 mb-1"
                    >
                      ✕
                    </button>
                  </div>
                  <Textarea
                    id={`canon-char-${i}-description`}
                    label="Description"
                    value={char.description}
                    onChange={e => updateCharacterTextField(i, 'description', e.target.value)}
                    placeholder="Description"
                    rows={2}
                  />
                  <Input
                    id={`canon-char-${i}-personality`}
                    label="Personality"
                    value={char.personality ?? ''}
                    onChange={e => updateCharacterTextField(i, 'personality', e.target.value)}
                    placeholder="Optional"
                  />
                  <details className="rounded-lg border border-[var(--border)] bg-[var(--bg-input)] p-3">
                    <summary className="cursor-pointer text-xs font-medium text-[var(--text-muted)] uppercase">
                      Appearance & Relationships
                    </summary>
                    <div className="mt-3 space-y-4">
                      <div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id={`canon-char-${i}-appearance-face`}
                            label="Face"
                            value={char.appearance?.face ?? ''}
                            onChange={e => updateCharacterAppearance(i, 'face', e.target.value)}
                            placeholder="Optional"
                          />
                          <Input
                            id={`canon-char-${i}-appearance-hair`}
                            label="Hair"
                            value={char.appearance?.hair ?? ''}
                            onChange={e => updateCharacterAppearance(i, 'hair', e.target.value)}
                            placeholder="Optional"
                          />
                          <Input
                            id={`canon-char-${i}-appearance-clothing`}
                            label="Clothing"
                            value={char.appearance?.clothing ?? ''}
                            onChange={e => updateCharacterAppearance(i, 'clothing', e.target.value)}
                            placeholder="Optional"
                          />
                          <Input
                            id={`canon-char-${i}-appearance-shoes`}
                            label="Shoes"
                            value={char.appearance?.shoes ?? ''}
                            onChange={e => updateCharacterAppearance(i, 'shoes', e.target.value)}
                            placeholder="Optional"
                          />
                          <Input
                            id={`canon-char-${i}-appearance-hat`}
                            label="Hat"
                            value={char.appearance?.hat ?? ''}
                            onChange={e => updateCharacterAppearance(i, 'hat', e.target.value)}
                            placeholder="Optional"
                          />
                          <Input
                            id={`canon-char-${i}-appearance-accessories`}
                            label="Accessories"
                            value={char.appearance?.accessories ?? ''}
                            onChange={e =>
                              updateCharacterAppearance(i, 'accessories', e.target.value)
                            }
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[var(--text-muted)] uppercase">
                            Relationships
                          </span>
                          <button
                            type="button"
                            onClick={() => addCharacterRelationship(i)}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            + Add
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(char.relationships ?? []).map((rel, relIdx) => (
                            <div key={relIdx} className="flex items-center gap-2">
                              <div className="w-48">
                                <Input
                                  id={`canon-char-${i}-rel-${relIdx}-type`}
                                  label="Type"
                                  value={rel.type ?? ''}
                                  onChange={e =>
                                    updateCharacterRelationship(i, relIdx, 'type', e.target.value)
                                  }
                                  placeholder="friend/enemy/family"
                                />
                              </div>
                              <div className="flex-1">
                                <Input
                                  id={`canon-char-${i}-rel-${relIdx}-to`}
                                  label="To"
                                  value={rel.to ?? ''}
                                  onChange={e =>
                                    updateCharacterRelationship(i, relIdx, 'to', e.target.value)
                                  }
                                  placeholder="Other character"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCharacterRelationship(i, relIdx)}
                                className="text-red-500"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleGenerateCharacterImage(i)}
                      disabled={generatingCharacterIndex === i}
                      className="px-3 py-1 text-xs font-medium rounded bg-[var(--accent)] text-white disabled:opacity-50"
                    >
                      {generatingCharacterIndex === i ? 'Generating…' : 'Generate Image'}
                    </button>
                    {char.image_url && (
                      <a
                        href={char.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Open image
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
            Locations
          </label>
          <button
            type="button"
            onClick={addLocation}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {editContent.locations.map((loc, i) => (
            <div key={i} className="p-3 bg-[var(--bg-hover)] rounded-lg space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    id={`canon-loc-${i}-name`}
                    label="Name"
                    value={loc.name}
                    onChange={e => updateLocation(i, 'name', e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <button type="button" onClick={() => removeLocation(i)} className="text-red-500 mb-1">
                  ✕
                </button>
              </div>
              <Textarea
                id={`canon-loc-${i}-description`}
                label="Description"
                value={loc.description}
                onChange={e => updateLocation(i, 'description', e.target.value)}
                placeholder="Visual description"
                rows={2}
              />
              <Input
                id={`canon-loc-${i}-mood`}
                label="Mood"
                value={loc.mood ?? ''}
                onChange={e => updateLocation(i, 'mood', e.target.value)}
                placeholder="Optional"
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Themes</label>
          <button
            type="button"
            onClick={addTheme}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {editContent.themes.map((theme, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-52">
                <Input
                  id={`canon-theme-${i}`}
                  label={`Theme ${i + 1}`}
                  value={theme}
                  onChange={e => updateTheme(i, e.target.value)}
                  placeholder="Theme"
                />
              </div>
              <button type="button" onClick={() => removeTheme(i)} className="text-red-500 text-xs">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
            World Rules
          </label>
          <button
            type="button"
            onClick={addWorldRule}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {editContent.worldRules.map((rule, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  id={`canon-world-rule-${i}`}
                  label={`Rule ${i + 1}`}
                  value={rule}
                  onChange={e => updateWorldRule(i, e.target.value)}
                  placeholder="Rule"
                />
              </div>
              <button type="button" onClick={() => removeWorldRule(i)} className="text-red-500">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">Equipment</label>
          <button
            type="button"
            onClick={addEquipment}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {editContent.equipment.map((item, i) => (
            <div key={i} className="p-3 bg-[var(--bg-hover)] rounded-lg space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    id={`canon-equipment-${i}-name`}
                    label="Name"
                    value={item.name}
                    onChange={e => updateEquipment(i, 'name', e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div className="w-56">
                  <Input
                    id={`canon-equipment-${i}-owner`}
                    label="Owner"
                    value={item.owner ?? ''}
                    onChange={e => updateEquipment(i, 'owner', e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <button type="button" onClick={() => removeEquipment(i)} className="text-red-500">
                  ✕
                </button>
              </div>
              <Textarea
                id={`canon-equipment-${i}-description`}
                label="Description"
                value={item.description}
                onChange={e => updateEquipment(i, 'description', e.target.value)}
                placeholder="Description"
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase">
            Continuity
          </label>
          <button
            type="button"
            onClick={addContinuity}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {editContent.continuity.map((rule, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  id={`canon-continuity-${i}`}
                  label={`Constraint ${i + 1}`}
                  value={rule}
                  onChange={e => updateContinuity(i, e.target.value)}
                  placeholder="Continuity constraint"
                />
              </div>
              <button type="button" onClick={() => removeContinuity(i)} className="text-red-500">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const selectedVersion = selectedAsset?.current_version;
  const selectedRunId = selectedVersion?.workflow_run_id;
  const selectedRun = selectedRunId ? filteredRunMap.find(r => r.id === selectedRunId) : null;
  const selectedWorkflowVersionId = selectedRun?.workflow_version_id;
  const selectedWorkflowTitle =
    selectedWorkflowVersionId && workflowMap ? workflowMap[selectedWorkflowVersionId] : null;
  const selectedWorkflowRef = selectedRunId
    ? selectedWorkflowTitle || `Run ${selectedRunId.slice(0, 8)}`
    : selectedVersion?.source_mode === 'workflow'
      ? 'Workflow generated'
      : selectedVersion?.source_mode === 'copilot'
        ? 'Copilot generated'
        : 'Manual';

	  return (
	    <div className="flex flex-col h-full comfy-bg-primary">
		      <div className="p-4 flex items-center justify-between gap-3">
	        <div className="min-w-0">
	          <div className="text-sm font-semibold text-comfy-text truncate">Story & Canon</div>
	        </div>
	        <div className="flex items-center gap-2">
	          {selectedWorkflowVersionId && projectIdParam && (
	            <button
	              type="button"
              className="comfy-btn-secondary text-xs"
              onClick={() =>
                navigate(`/projects/${projectIdParam}/workflows?select=${selectedWorkflowVersionId}`)
              }
            >
              Workflow
	            </button>
	          )}
	        </div>
	      </div>

	      <div className="p-4 border-b border-comfy-border">
	        <div className="flex items-end gap-2">
	          <div className="flex-1 min-w-0">
	            <select
	              value={selectedAssetId || canonListItems[0]?.assetId || ''}
	              onChange={e => handleSelectAssetId(e.target.value)}
	              className="comfy-input w-full text-xs"
              disabled={canonListItems.length === 0}
            >
              {canonListItems.length === 0 ? (
                <option value="">No canon yet</option>
              ) : (
                canonListItems.map(item => (
                  <option key={item.assetId} value={item.assetId}>
                    {item.title} · {new Date(item.updatedAt).toLocaleDateString()}
                  </option>
                ))
              )}
	            </select>
	          </div>
		          <div className="flex items-center gap-2">
		            <button
		              type="button"
		              onClick={handleCreateCanon}
		              disabled={createMutation.isPending}
		              className="comfy-btn text-xs disabled:opacity-50"
		            >
		              + Add
		            </button>
		            <button
		              type="button"
		              onClick={handleDelete}
		              disabled={!selectedAsset || deleteMutation.isPending || updateMutation.isPending}
		              className="comfy-btn-danger text-xs disabled:opacity-50"
		            >
		              Delete
		            </button>
		            {!selectedAsset ? null : isEditing ? (
		              <>
		                <button
		                  type="button"
		                  onClick={() => {
	                    setEditContent(getContent(selectedAsset));
	                    setIsEditing(false);
	                  }}
	                  disabled={updateMutation.isPending}
	                  className="comfy-btn-secondary text-xs disabled:opacity-50"
	                >
	                  Cancel
	                </button>
	                <button
	                  type="button"
	                  onClick={handleSave}
	                  disabled={updateMutation.isPending}
	                  className="comfy-btn text-xs disabled:opacity-50"
	                >
	                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
	                </button>
	              </>
	            ) : (
	              <button type="button" onClick={handleBeginEdit} className="comfy-btn-secondary text-xs">
	                Edit
	              </button>
	            )}
	          </div>
	        </div>

      </div>

      <div className="flex-1 overflow-auto p-4">
        {selectedAsset ? (
          isEditing ? (
            renderEditForm()
          ) : (
            renderView(getContent(selectedAsset))
          )
        ) : (
          <div className="text-sm text-comfy-muted">
            {canonListItems.length === 0
              ? 'No canon documents yet. Create one to get started.'
              : 'Select a canon document from the dropdown.'}
          </div>
        )}
      </div>
    </div>
  );
}
