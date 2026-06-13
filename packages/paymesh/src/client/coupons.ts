import { splitExtraFields } from '../shared/database/fields';
import type {
	PaymeshCoupon,
	PaymeshCouponCheckResult,
	PaymeshCouponCreateData,
	PaymeshCouponList,
	PaymeshCouponUpdateData,
} from '../types/client';
import type {
	DatabaseSchemaOptions,
	PaymeshCouponListOptions,
	PaymeshDatabaseDriver,
	ResolvedDatabaseSchema,
} from '../types/database';
import type {
	CouponCheckData,
	Provider,
	ProviderRequestOptions,
} from '../types/providers';
import { getRequiredProviderFeature, resolveIncludeRaw } from './helpers';

export function createCouponsClient<
	Schema extends DatabaseSchemaOptions,
	P extends Provider<string>,
	IncludeRaw extends boolean,
>({
	assertCapability,
	baseIncludeRaw,
	database,
	mergeOptions,
	provider,
	schema,
}: {
	assertCapability: (capability: 'coupons') => void;
	baseIncludeRaw: boolean;
	database?: PaymeshDatabaseDriver;
	mergeOptions: <CallIncludeRaw extends boolean = false>(
		requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
	) => ProviderRequestOptions<CallIncludeRaw>;
	provider: P;
	schema: ResolvedDatabaseSchema;
}) {
	const couponsRepository = database?.repositories.coupons;
	const getProviderCoupons = () =>
		getRequiredProviderFeature(provider.coupons, provider.id, 'coupons');

	return {
		create: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: PaymeshCouponCreateData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();

			const { input, extra } = splitExtraFields(
				data,
				schema.tables.coupons.fields,
			);
			const coupon = await providerCoupons.create(
				input as Parameters<typeof providerCoupons.create>[0],
				mergeOptions(requestOptions),
			);
			const resolvedCoupon = Object.assign(coupon, extra) as PaymeshCoupon<
				CallIncludeRaw,
				Schema
			>;

			if (couponsRepository) {
				await couponsRepository.upsert(schema, resolvedCoupon);
			}

			return resolvedCoupon;
		},
		get: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: string,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();
			const mergedOptions = mergeOptions(requestOptions);

			if (couponsRepository) {
				const coupon = await couponsRepository.findByProviderId(
					schema,
					provider.id,
					mergedOptions.sandbox ?? provider.isSandbox(),
					id,
					{
						includeRaw: mergedOptions.includeRaw,
					},
				);

				if (coupon) {
					return coupon as PaymeshCoupon<CallIncludeRaw, Schema>;
				}
			}

			return providerCoupons.get(id, mergedOptions) as Promise<
				PaymeshCoupon<CallIncludeRaw, Schema>
			>;
		},
		list: async <CallIncludeRaw extends boolean = IncludeRaw>(
			options?: PaymeshCouponListOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();

			if (couponsRepository) {
				const result = await couponsRepository.list(
					schema,
					provider.id,
					options?.sandbox ?? provider.isSandbox(),
					{
						includeRaw: resolveIncludeRaw(
							options?.includeRaw,
							baseIncludeRaw,
						) as CallIncludeRaw,
						limit: options?.limit,
						after: options?.after,
						before: options?.before,
						code: options?.code,
						active: options?.active,
					},
				);

				return {
					...result,
					data: result.data as Array<PaymeshCoupon<CallIncludeRaw, Schema>>,
				} as PaymeshCouponList<CallIncludeRaw, Schema>;
			}

			return providerCoupons.list(
				{
					limit: options?.limit,
					after: options?.after,
					before: options?.before,
					code: options?.code,
					active: options?.active,
				},
				mergeOptions({
					includeRaw: resolveIncludeRaw(
						options?.includeRaw,
						baseIncludeRaw,
					) as CallIncludeRaw,
					sandbox: options?.sandbox,
				}),
			) as Promise<PaymeshCouponList<CallIncludeRaw, Schema>>;
		},
		update: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: string,
			data: PaymeshCouponUpdateData<Schema>,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();

			const { input, extra } = splitExtraFields(
				data,
				schema.tables.coupons.fields,
			);
			const coupon = await providerCoupons.update(
				id,
				input as Parameters<typeof providerCoupons.update>[1],
				mergeOptions(requestOptions),
			);
			const resolvedCoupon = Object.assign(coupon, extra) as PaymeshCoupon<
				CallIncludeRaw,
				Schema
			>;

			if (couponsRepository) {
				await couponsRepository.upsert(schema, resolvedCoupon);
			}

			return resolvedCoupon;
		},
		delete: async <CallIncludeRaw extends boolean = IncludeRaw>(
			id: string,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();
			const result = await providerCoupons.delete(
				id,
				mergeOptions(requestOptions),
			);

			if (couponsRepository) {
				await couponsRepository.markDeleted(schema, result);
			}

			return result;
		},
		check: async <CallIncludeRaw extends boolean = IncludeRaw>(
			data: CouponCheckData,
			requestOptions?: ProviderRequestOptions<CallIncludeRaw>,
		) => {
			assertCapability('coupons');
			const providerCoupons = getProviderCoupons();
			const result = await providerCoupons.check(
				data,
				mergeOptions(requestOptions),
			);

			if (couponsRepository && result.coupon) {
				await couponsRepository.upsert(
					schema,
					result.coupon as PaymeshCoupon<CallIncludeRaw, Schema>,
				);
			}

			return result as PaymeshCouponCheckResult<CallIncludeRaw, Schema>;
		},
	};
}
