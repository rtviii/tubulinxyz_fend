import { useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery } from '@/store/tubxz_api';

interface ChainAnnotationSummaryProps {
  rcsb_id: string;
  auth_asym_id: string;
}

export function ChainAnnotationSummary({ rcsb_id, auth_asym_id }: ChainAnnotationSummaryProps) {
  const { data, isLoading, error } = useGetPolymerAllAnnotationsAnnotationsPolymerRcsbIdAuthAsymIdAllGetQuery({
    rcsbId: rcsb_id,
    authAsymId: auth_asym_id
  });

  if (isLoading) {
    return <div className="text-xs text-gray-500 py-1">Loading annotations...</div>;
  }

  if (error || !data) {
    return <div className="text-xs text-gray-400 py-1">No annotation data</div>;
  }

  const mutations = data.mutations || [];
  const modifications = data.modifications || [];
  const totalCount = mutations.length + modifications.length;

  if (totalCount === 0) {
    return <div className="text-xs text-gray-400 py-1">No mutations/modifications</div>;
  }

  return (
    <div className="text-xs space-y-1">
      {mutations.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-red-600">
            {mutations.length} mutation{mutations.length !== 1 ? 's' : ''}
          </span>
          <div className="flex-1 flex flex-wrap gap-1">
            {mutations.slice(0, 5).map((mut: any, i: number) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded font-mono text-xs border border-red-200"
              >
                {mut.from_residue}{mut.master_index}{mut.to_residue}
              </span>
            ))}
            {mutations.length > 5 && (
              <span className="text-gray-500">+{mutations.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {modifications.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-600">
            {modifications.length} modification{modifications.length !== 1 ? 's' : ''}
          </span>
          <div className="flex-1 flex flex-wrap gap-1">
            {modifications.slice(0, 3).map((mod: any, i: number) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200"
              >
                {mod.modification_type}@{mod.master_index}
              </span>
            ))}
            {modifications.length > 3 && (
              <span className="text-gray-500">+{modifications.length - 3} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}