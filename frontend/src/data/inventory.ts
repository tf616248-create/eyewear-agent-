import inventoryData from './eyewear_inventory.json';
import { type Frame } from '../types/frame.types';
import { type FrameWithReason } from '../context/appContextTypes';

type InventoryFrame = Omit<Frame, 'image'> & {
	images: { front: string };
};

export const inventory: InventoryFrame[] = inventoryData as InventoryFrame[];

export function mapRecommendationsById(recommendations: FrameWithReason[]): FrameWithReason[] {
	return recommendations.flatMap(recommendation => {
		const canonicalFrame = inventory.find(frame => frame.id === recommendation.id);
		return canonicalFrame
			? [{
				...canonicalFrame,
				image: canonicalFrame.images.front,
				reason: recommendation.reason,
			}]
			: [];
	});
}