using Google.Cloud.Firestore;
using HackHive.Shared.Models;

namespace HackHive.Shared.Repositories;

public class FirestoreUserRepository : IUserRepository
{
    private readonly FirestoreDb _db;

    public FirestoreUserRepository(FirestoreDb db)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));
    }

    public async Task<UserProfileRecord?> GetUserAsync(string uid, CancellationToken ct = default)
    {
        var doc = await _db.Collection("Users").Document(uid).GetSnapshotAsync(ct);
        if (!doc.Exists) return null;

        var data = doc.ToDictionary();
        return new UserProfileRecord
        {
            Uid = doc.Id,
            Email = data.TryGetValue("email", out var em) ? em?.ToString() : null,
            DisplayName = data.TryGetValue("displayName", out var dn) ? dn?.ToString() : null,
            Role = data.TryGetValue("role", out var r) ? r?.ToString() ?? "student" : "student",
            CohortId = data.TryGetValue("cohortId", out var ch) ? ch?.ToString() : null,
            ManagedCohorts = doc.ContainsField("managedCohorts") ? doc.GetValue<List<string>>("managedCohorts") : []
        };
    }

    public async Task<UserProfileRecord> UpsertUserAsync(UserProfileRecord user, CancellationToken ct = default)
    {
        var docRef = _db.Collection("Users").Document(user.Uid);
        var data = new Dictionary<string, object>
        {
            ["uid"] = user.Uid,
            ["role"] = user.Role,
            ["updatedAt"] = Timestamp.GetCurrentTimestamp()
        };
        if (!string.IsNullOrWhiteSpace(user.Email)) data["email"] = user.Email;
        if (!string.IsNullOrWhiteSpace(user.DisplayName)) data["displayName"] = user.DisplayName;
        if (!string.IsNullOrWhiteSpace(user.CohortId)) data["cohortId"] = user.CohortId;
        if (user.ManagedCohorts.Count > 0) data["managedCohorts"] = user.ManagedCohorts;

        await docRef.SetAsync(data, SetOptions.MergeAll, ct);
        return user;
    }

    public async Task<IReadOnlyList<UserProfileRecord>> ListUsersAsync(int limit = 100, CancellationToken ct = default)
    {
        var snapshot = await _db.Collection("Users").Limit(limit).GetSnapshotAsync(ct);
        return snapshot.Documents.Select(doc =>
        {
            var data = doc.ToDictionary();
            return new UserProfileRecord
            {
                Uid = doc.Id,
                Email = data.TryGetValue("email", out var em) ? em?.ToString() : null,
                DisplayName = data.TryGetValue("displayName", out var dn) ? dn?.ToString() : null,
                Role = data.TryGetValue("role", out var r) ? r?.ToString() ?? "student" : "student",
                CohortId = data.TryGetValue("cohortId", out var ch) ? ch?.ToString() : null,
                ManagedCohorts = doc.ContainsField("managedCohorts") ? doc.GetValue<List<string>>("managedCohorts") : []
            };
        }).ToList();
    }

    public async Task<bool> UpdateUserRoleAsync(string uid, string role, CancellationToken ct = default)
    {
        var docRef = _db.Collection("Users").Document(uid);
        await docRef.UpdateAsync(new Dictionary<string, object>
        {
            ["role"] = role,
            ["updatedAt"] = Timestamp.GetCurrentTimestamp()
        }, cancellationToken: ct);
        return true;
    }
}
