import { type Frame } from '../types/frame.types';
import { type FrameWithReason } from '../context/appContextTypes';

export type InventoryFrame = Omit<Frame, 'image'> & {
	path: string;
};

export function mapRecommendationsById(
	recommendations: FrameWithReason[],
	catalog: InventoryFrame[],
): FrameWithReason[] {
	return recommendations.flatMap(recommendation => {
		const canonicalFrame = catalog.find(frame => frame.id === recommendation.id);
		return canonicalFrame
			? [{
				...canonicalFrame,
				image: canonicalFrame.path,
				reason: recommendation.reason,
			}]
			: [];
	});
}
