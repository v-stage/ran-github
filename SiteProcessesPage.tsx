import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Factory,
  Layers,
  FileText,
  Loader,
  AlertTriangle,
  MapPin,
  Building2,
  Building,
  ChevronRight,
  BarChart3,
  Zap,
  Target,
  Settings,
  Users,
  LayoutGrid,
  List,
  Calendar,
  Search,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import isEqual from 'lodash.isequal';

interface IssueWithAxis {
  code: string;
  name: string;
  axe_energetique: string | null;
}

interface Indicator {
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  type: string | null;
  formula: string | null;
  frequency: string | null;
  processus_code: string;
}

interface IndicatorValue {
  id: string;
  indicator_code: string;
  processus_code: string;
  period_id: string;
  value: number | null;
  organization_name: string;
  site_name: string | null;
  created_at: string;
  collection_periods?: {
    year: number;
    period_number: number | null;
  };
}

interface UserProcessus {
  email: string;
  processus_code: string;
}

interface Site {
  name: string;
  address: string;
  city: string;
  country: string;
  filiere_name: string | null;
  filiale_name: string | null;
  organization_name: string;
}

interface Processus {
  code: string;
  name: string;
  description: string | null;
  icon_type?: string;
}

const SiteProcessesPage: React.FC = () => {
  const navigate = useNavigate();
  const { siteName } = useParams<{ siteName: string }>();
  const { user } = useAuth();
  const [site, setSite] = useState<Site | null>(null);
  const [processus, setProcessus] = useState<Processus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [siteUsers, setSiteUsers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'process' | 'global'>('process');

  // Global view state
  const [allIndicators, setAllIndicators] = useState<Indicator[]>([]);
  const [indicatorValues, setIndicatorValues] = useState<Record<string, IndicatorValue[]>>({});
  const [initialIndicatorValues, setInitialIndicatorValues] = useState<Record<string, IndicatorValue[]>>({});
  const [isLoadingIndicators, setIsLoadingIndicators] = useState(false);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Energy context data
  const [energySector, setEnergySector] = useState<{name: string} | null>(null);
  const [energyType, setEnergyType] = useState<{name: string; sector_name: string} | null>(null);
  const [standards, setStandards] = useState<{code: string; name: string}[]>([]);
  const [issues, setIssues] = useState<IssueWithAxis[]>([]);
  const [criteria, setCriteria] = useState<{code: string; name: string}[]>([]);
  const [issueStandards, setIssueStandards] = useState<Record<string, string>>({});

  // Years for filtering
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  // Months for display
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const [dataSaved, setDataSaved] = useState(false);

  useEffect(() => {
    if (siteName) {
      fetchSiteData();
    }
  }, [siteName]);

  useEffect(() => {
    if (site) {
      fetchSiteUsers();
    }
  }, [site]);

  useEffect(() => {
    if (siteUsers.length > 0) {
      fetchSiteProcessus();
      if (viewMode === 'global') {
        fetchAllIndicators();
      }
    }
  }, [siteUsers, viewMode]);

  useEffect(() => {
    if (viewMode === 'global' && allIndicators.length > 0) {
      fetchAllIndicatorValues();
    }
  }, [viewMode, allIndicators, yearFilter]);

  useEffect(() => {
    if (site?.organization_name) {
      fetchEnergyContext();
    }
  }, [site?.organization_name]);

  useEffect(() => {
    if (!isEqual(indicatorValues, initialIndicatorValues)) {
      saveGlobalIndicatorData();
    }
  }, [indicatorValues]);

  const fetchSiteData = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('name', siteName)
        .single();

      if (error) throw error;

      setSite(data);
    } catch (err: any) {
      console.error('Error fetching site data:', err);
      setError('Erreur lors du chargement des données du site: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSiteUsers = async () => {
    try {
      if (!site?.organization_name) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('organization_name', site.organization_name)
        .eq('site_name', siteName)
        .eq('role', 'contributeur');

      if (error) throw error;

      const userEmails = data?.map(user => user.email) || [];
      setSiteUsers(userEmails);
    } catch (err: any) {
      console.error('Error fetching site users:', err);
      setError('Erreur lors du chargement des utilisateurs du site: ' + err.message);
    }
  };

  const fetchSiteProcessus = async () => {
    try {
      if (siteUsers.length === 0) {
        setProcessus([]);
        return;
      }

      const { data: userProcessusData, error: userProcessusError } = await supabase
        .from('user_processus')
        .select('processus_code')
        .in('email', siteUsers);

      if (userProcessusError) throw userProcessusError;

      if (!userProcessusData || userProcessusData.length === 0) {
        setProcessus([]);
        return;
      }

      const processusCodes = [...new Set(userProcessusData.map(up => up.processus_code))];

      const { data: processusData, error: processusError } = await supabase
        .from('processus')
        .select('*')
        .in('code', processusCodes)
        .order('name');

      if (processusError) throw processusError;

      const iconTypes = ['management', 'operation', 'support', 'measurement', 'improvement'];
      const processusWithIcons = processusData?.map(proc => ({
        ...proc,
        icon_type: iconTypes[Math.floor(Math.random() * iconTypes.length)]
      })) || [];

      setProcessus(processusWithIcons);
    } catch (err: any) {
      console.error('Error fetching processus:', err);
      setError('Erreur lors du chargement des processus: ' + err.message);
    }
  };

  const fetchAllIndicators = async () => {
    try {
      if (processus.length === 0) {
        setAllIndicators([]);
        return;
      }

      setIsLoadingIndicators(true);

      const processusCodes = processus.map(p => p.code);

      const { data, error } = await supabase
        .from('indicators')
        .select('*')
        .in('processus_code', processusCodes);

      if (error) throw error;

      setAllIndicators(data || []);
    } catch (err: any) {
      console.error('Error fetching all indicators:', err);
      setError('Erreur lors du chargement des indicateurs: ' + err.message);
    } finally {
      setIsLoadingIndicators(false);
    }
  };

  const fetchAllIndicatorValues = async () => {
    try {
      setIsLoadingIndicators(true);

      const indicatorCodes = allIndicators.map(ind => ind.code);

      if (indicatorCodes.length === 0) {
        setIndicatorValues({});
        return;
      }

      // Fetch values for current year
      const { data: currentYearData, error: currentYearError } = await supabase
        .from('indicator_values')
        .select(`
          *,
          collection_periods (
            year,
            period_number
          )
        `)
        .in('indicator_code', indicatorCodes)
        .eq('collection_periods.year', yearFilter)
        .eq('site_name', siteName);

      if (currentYearError) throw currentYearError;

      // Fetch values for previous year
      const { data: prevYearData, error: prevYearError } = await supabase
        .from('indicator_values')
        .select(`
          *,
          collection_periods (
            year,
            period_number
          )
        `)
        .in('indicator_code', indicatorCodes)
        .eq('collection_periods.year', yearFilter - 1)
        .eq('site_name', siteName);

      if (prevYearError) throw prevYearError;

      // Group values by indicator code
      const valuesByIndicator: Record<string, IndicatorValue[]> = {};

      [...(currentYearData || []), ...(prevYearData || [])].forEach(value => {
        if (!valuesByIndicator[value.indicator_code]) {
          valuesByIndicator[value.indicator_code] = [];
        }
        valuesByIndicator[value.indicator_code].push(value);
      });

      setIndicatorValues(valuesByIndicator);
      setInitialIndicatorValues(valuesByIndicator);
    } catch (err: any) {
      console.error('Error fetching indicator values:', err);
      setError('Erreur lors du chargement des valeurs d\'indicateurs: ' + err.message);
    } finally {
      setIsLoadingIndicators(false);
    }
  };

  const fetchEnergyContext = async () => {
    try {
      if (!site?.organization_name) return;

      // Get the organization's energy context
      const { data: selectionData, error: selectionError } = await supabase
        .from('organization_selections')
        .select('*')
        .eq('organization_name', site.organization_name)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (selectionError && selectionError.code !== 'PGRST116') throw selectionError;

      if (selectionData) {
        // Fetch sector
        const { data: sectorData } = await supabase
          .from('sectors')
          .select('name')
          .eq('name', selectionData.sector_name)
          .single();

        setEnergySector(sectorData || null);

        // Fetch energy type
        const { data: energyTypeData } = await supabase
          .from('energy_types')
          .select('name, sector_name')
          .eq('name', selectionData.energy_type_name)
          .eq('sector_name', selectionData.sector_name)
          .single();

        setEnergyType(energyTypeData || null);

        // Fetch standards
        if (selectionData.standard_names && selectionData.standard_names.length > 0) {
          const { data: standardsData } = await supabase
            .from('standards')
            .select('code, name')
            .in('name', selectionData.standard_names);

          setStandards(standardsData || []);
        }

        // Fetch issues
        if (selectionData.issue_names && selectionData.issue_names.length > 0) {
          const { data: issuesData } = await supabase
            .from('issues')
            .select('code, name, axe_energetique')
            .in('name', selectionData.issue_names);

          setIssues(issuesData || []);

          // Fetch standards for each issue
          const issueStandardsMap: Record<string, string> = {};

          for (const issue of selectionData.issue_names) {
            const { data: standardData } = await supabase
              .from('sector_standards_issues_criteria')
              .select('standard_name')
              .eq('issue_name', issue)
              .eq('sector_name', selectionData.sector_name)
              .eq('energy_type_name', selectionData.energy_type_name)
              .limit(1)
              .single();

            if (standardData) {
              issueStandardsMap[issue] = standardData.standard_name;
            }
          }

          setIssueStandards(issueStandardsMap);
        }

        // Fetch criteria
        if (selectionData.criteria_names && selectionData.criteria_names.length > 0) {
          const { data: criteriaData } = await supabase
            .from('criteria')
            .select('code, name')
            .in('name', selectionData.criteria_names);

          setCriteria(criteriaData || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching energy context:', err);
      // Don't set error state to avoid blocking the main functionality
    }
  };

  const saveGlobalIndicatorData = async () => {
    try {
      if (!siteName || filteredIndicators.length === 0) return;

      setIsLoading(true);

      // Prepare data for batch insert
      const dataToInsert = filteredIndicators.map(indicator => {
        const currentYearValue = getIndicatorValueForYear(indicator.code, yearFilter);
        const processInfo = processus.find(p => p.code === indicator.processus_code);

        return {
          site_name: siteName,
          axe_energetique: issues.find(i => i.name === issues[0]?.name)?.axe_energetique || null,
          enjeux: issues.length > 0 ? issues[0].name : null,
          normes: standards.length > 0 ? standards[0].name : null,
          critere: criteria.length > 0 ? criteria[0].name : null,
          code: indicator.code,
          indicateur: indicator.name,
          processus: processInfo?.name || null,
          frequence: indicator.frequency || 'Mensuelle',
          unite: indicator.unit || null,
          type: indicator.type || 'Quantitatif',
          formule: indicator.formula || null,
          year: yearFilter,
          value: currentYearValue,
          cible: null,
          variation: calculateVariation(
            currentYearValue,
            getIndicatorValueForYear(indicator.code, yearFilter - 1)
          )
        };
      });

      // Delete existing data for this site and year to avoid duplicates
      const { error: deleteError } = await supabase
        .from('site_global_indicator_values')
        .delete()
        .eq('site_name', siteName)
        .eq('year', yearFilter);

      if (deleteError) throw deleteError;

      // Insert new data
      const { error: insertError } = await supabase
        .from('site_global_indicator_values')
        .insert(dataToInsert);

      if (insertError) throw insertError;

      setDataSaved(true);
      setTimeout(() => setDataSaved(false), 3000);

    } catch (err: any) {
      console.error('Error saving global indicator data:', err);
      setError("Erreur lors de l'enregistrement des données: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessusClick = (processusCode: string) => {
    navigate(`/site/${siteName}/process/${processusCode}`);
  };

  const handleViewModeChange = (mode: 'process' | 'global') => {
    setViewMode(mode);
    if (mode === 'global' && allIndicators.length === 0) {
      fetchAllIndicators();
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const toggleRowExpansion = (indicatorCode: string) => {
    setExpandedRows(prev =>
      prev.includes(indicatorCode)
        ? prev.filter(code => code !== indicatorCode)
        : [...prev, indicatorCode]
    );
  };

  const getIndicatorValueForYear = (indicatorCode: string, year: number): number | null => {
    const values = indicatorValues[indicatorCode] || [];
    // Sum all monthly values for this year
    const monthlyValues = values.filter(v =>
      v.collection_periods?.year === year &&
      v.collection_periods?.period_number !== null
    );

    if (monthlyValues.length === 0) return null;

    // Sum all values
    return monthlyValues.reduce((sum, v) => sum + (v.value || 0), 0);
  };

  const getIndicatorValueForMonth = (indicatorCode: string, year: number, month: number): number | null => {
    const values = indicatorValues[indicatorCode] || [];
    const monthValue = values.find(v => v.collection_periods?.year === year && v.collection_periods?.period_number === month);
    return monthValue?.value || null;
  };

  const calculateVariation = (current: number | null, previous: number | null): string => {
    if (current === null || previous === null || previous === 0) return '-';
    const variation = ((current - previous) / previous) * 100;
    return variation.toFixed(2) + '%';
  };

  const filteredIndicators = allIndicators.filter(indicator => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      indicator.name.toLowerCase().includes(searchLower) ||
      indicator.code.toLowerCase().includes(searchLower) ||
      (indicator.description && indicator.description.toLowerCase().includes(searchLower))
    );
  });

  const getProcessusIcon = (iconType: string = 'default') => {
    switch (iconType) {
      case 'management':
        return <Settings className="w-6 h-6 text-blue-600" />;
      case 'operation':
        return <Zap className="w-6 h-6 text-amber-600" />;
      case 'support':
        return <Users className="w-6 h-6 text-purple-600" />;
      case 'measurement':
        return <BarChart3 className="w-6 h-6 text-green-600" />;
      case 'improvement':
        return <Target className="w-6 h-6 text-red-600" />;
      default:
        return <Layers className="w-6 h-6 text-gray-600" />;
    }
  };

  const getProcessusColor = (iconType: string = 'default') => {
    switch (iconType) {
      case 'management':
        return 'from-blue-500 to-indigo-600';
      case 'operation':
        return 'from-amber-500 to-orange-600';
      case 'support':
        return 'from-purple-500 to-violet-600';
      case 'measurement':
        return 'from-green-500 to-emerald-600';
      case 'improvement':
        return 'from-red-500 to-rose-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  const getProcessusLightColor = (iconType: string = 'default') => {
    switch (iconType) {
      case 'management':
        return 'bg-blue-50';
      case 'operation':
        return 'bg-amber-50';
      case 'support':
        return 'bg-purple-50';
      case 'measurement':
        return 'bg-green-50';
      case 'improvement':
        return 'bg-red-50';
      default:
        return 'bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center max-w-md text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-6"
          >
            <div className="w-16 h-16 rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Chargement des données</h2>
          <p className="text-gray-600">Nous préparons les processus associés à ce site...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-500 to-rose-600 p-6 text-white">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-8 h-8" />
              <h1 className="text-2xl font-bold">Erreur de chargement</h1>
            </div>
          </div>
          <div className="p-8">
            <p className="text-gray-700 mb-8">{error}</p>
            <button
              onClick={handleBack}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg w-full"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Retour</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 relative overflow-x-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 -right-20 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <header className="mb-12">
          <div className="flex justify-between items-center mb-8">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 px-4 py-2.5 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 text-gray-700 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour</span>
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                {site?.name || 'Site'}
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Sélectionnez un processus pour accéder à ses indicateurs et données
            </p>
          </motion.div>
        </header>

        <main>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 flex justify-between items-center"
          >
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Gestion des indicateurs</h2>
              <p className="text-gray-600">
                {viewMode === 'process'
                  ? "Sélectionnez un processus pour accéder à ses détails et indicateurs"
                  : "Vue globale de tous les indicateurs du site"}
              </p>
            </div>

            <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <button
                onClick={() => setViewMode('process')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'process' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4" />
                <span>Par processus</span>
              </button>
              <button
                onClick={() => setViewMode('global')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${viewMode === 'global' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Globale</span>
              </button>
            </div>
          </motion.div>

          {viewMode === 'process' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processus.map((proc, index) => (
                <motion.div
                  key={`${proc.code}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleProcessusClick(proc.code)}
                  className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden cursor-pointer group"
                >
                  <div className={`h-2 w-full bg-gradient-to-r ${getProcessusColor(proc.icon_type)}`}></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl ${getProcessusLightColor(proc.icon_type)}`}>
                        {getProcessusIcon(proc.icon_type)}
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-lg font-bold text-gray-800 mb-2">{proc.name}</h3>
                    {proc.description && (
                      <p className="text-gray-600 text-sm line-clamp-2">{proc.description}</p>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {proc.code}
                      </span>
                      <span className="text-sm text-blue-600 font-medium group-hover:underline">
                        Voir les indicateurs
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {dataSaved && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 m-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-700">
                        Les données ont été enregistrées avec succès dans la base de données.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">Tous les Indicateurs de Performance Énergétique</h2>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(parseInt(e.target.value))}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        {years.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Rechercher un indicateur..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {isLoadingIndicators ? (
                  <div className="flex justify-center py-8">
                    <Loader className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                ) : filteredIndicators.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun indicateur trouvé</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      {searchQuery
                        ? "Aucun indicateur ne correspond à votre recherche."
                        : "Aucun indicateur n'est associé à ce site."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Axe Énergétique
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Enjeux
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Normes
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Critère
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Code
                          </th>
                          <th scope="col" className="px-7 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Indicateur
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Processus
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Fréquence
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Unité
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Type
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Formule
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          valeur   {yearFilter - 1}
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                           valeur {yearFilter}
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Cible
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Variation
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                            Détails
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredIndicators.map((indicator) => {
                          const isExpanded = expandedRows.includes(indicator.code);
                          const currentYearValue = getIndicatorValueForYear(indicator.code, yearFilter);
                          const previousYearValue = getIndicatorValueForYear(indicator.code, yearFilter - 1);
                          const variation = calculateVariation(currentYearValue, previousYearValue);
                          const processInfo = processus.find(p => p.code === indicator.processus_code);

                          return (
                            <React.Fragment key={indicator.code}>
                              <tr className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {issues.find(i => i.name === issues[0]?.name)?.axe_energetique || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {issues.length > 0 ? issues[0].name : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {issues.length > 0 && issueStandards[issues[0].name] ? issueStandards[issues[0].name] : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {criteria.length > 0 ? criteria[0].name : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">
                                  {indicator.code}
                                </td>
                                <td className="px-7 py-4 text-sm border-b border-gray-200">
                                  <div className="font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg shadow-sm">
                                    {indicator.name}
                                  </div>
                                  {indicator.description && (
                                    <p className="text-xs text-gray-500 mt-1">{indicator.description}</p>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {processInfo?.name || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {indicator.frequency || 'Mensuelle'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {indicator.unit || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {indicator.type || 'Quantitatif'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {indicator.formula || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {previousYearValue !== null ? previousYearValue : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {currentYearValue !== null ? currentYearValue : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  -
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  {variation}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                  <button
                                    onClick={() => toggleRowExpansion(indicator.code)}
                                    className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-800"
                                  >
                                    <span>Mensuel</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded monthly values */}
                              {isExpanded && (
                                <tr className="bg-gray-50">
                                  <td colSpan={15} className="px-6 py-4">
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                              Mois
                                            </th>
                                            {months.map((month, index) => (
                                              <th key={month} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                                {month}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          <tr>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">
                                              Valeur {yearFilter}
                                            </td>
                                            {months.map((_, index) => (
                                              <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-200">
                                                {getIndicatorValueForMonth(indicator.code, yearFilter, index + 1) || '-'}
                                              </td>
                                            ))}
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Information Box */}
              <div className="mt-8 mx-6 mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <HelpCircle className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">À propos des indicateurs de performance énergétique</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Les indicateurs de performance énergétique (IPE) sont des mesures quantifiables de la performance énergétique
                        qui permettent de suivre l'évolution de la consommation d'énergie et l'efficacité des actions d'amélioration.
                      </p>
                      <p className="mt-2">
                        Les valeurs mensuelles permettent un suivi plus précis des tendances et des variations saisonnières,
                        tandis que les valeurs annuelles offrent une vue d'ensemble de la performance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {viewMode === 'process' && processus.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-12 text-center"
            >
              <div className="mx-auto max-w-md">
                <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6">
                  <FileText className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {siteUsers.length === 0
                    ? "Aucun contributeur associé à ce site"
                    : "Aucun processus associé à ce site"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {siteUsers.length === 0
                    ? "Ce site n'a pas encore de contributeurs assignés."
                    : "Les contributeurs de ce site n'ont pas encore de processus assignés."}
                </p>
              </div>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SiteProcessesPage;
plutot que de cliquer sur un bouton je veux que cela se fasse automatiquement

You **must** respond now, using the `message_user` tool.
