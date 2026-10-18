using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public interface IUserRepository
{
    Task<UserProfileRecord?> GetUserAsync(string uid, CancellationToken ct = default);
    Task<UserProfileRecord> UpsertUserAsync(UserProfileRecord user, CancellationToken ct = default);
    Task<IReadOnlyList<UserProfileRecord>> ListUsersAsync(int limit = 100, CancellationToken ct = default);
    Task<bool> UpdateUserRoleAsync(string uid, string role, CancellationToken ct = default);
}
